// Diktat wie in Talos (lib/useDictation.ts, Batch-Weg): Mikrofon → PCM (AudioWorklet)
// → alle paar Sekunden eine Vorschau-Transkription, beim Bestätigen die endgültige.
// Das Audio geht als 16-kHz-WAV an den OpenAI-kompatiblen ASR-Endpunkt (Qwen3-ASR),
// der lokale Server leitet /asr weiter. Kein ffmpeg nötig.
import { useCallback, useEffect, useRef, useState } from 'react';

export type DictationStatus = 'idle' | 'starting' | 'recording' | 'finalizing';
export type DictationError = 'mic-denied' | 'insecure-context' | 'transcribe-failed' | 'no-mic' | 'no-audio';

const PREVIEW_INTERVAL_MS = 3000;
const TARGET_RATE = 16_000;
let asrModel: Promise<string> | null = null;
/** Modell der Spracherkennung aus den Server-Einstellungen */
function getAsrModel(): Promise<string> {
  asrModel ??= fetch('/config')
    .then((r) => (r.ok ? r.json() : {}))
    .then((c: { asrModel?: string }) => c.asrModel || 'qwen3-asr')
    .catch(() => 'qwen3-asr');
  return asrModel;
}

function toPcm16k(input: Float32Array, fromRate: number): Int16Array {
  const ratio = fromRate / TARGET_RATE;
  const outLen = Math.floor(input.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const s = input[i0] + (input[i1] - input[i0]) * (pos - i0);
    out[i] = Math.max(-32768, Math.min(32767, Math.round(s * 32767)));
  }
  return out;
}

/** PCM16-Stücke → WAV-Datei (16 kHz, mono) */
function wavBlob(chunks: Int16Array[]): Blob {
  const samples = chunks.reduce((n, c) => n + c.length, 0);
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, TARGET_RATE, true);
  v.setUint32(28, TARGET_RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples * 2, true);
  let o = 44;
  for (const c of chunks) {
    new Int16Array(buf, o, c.length).set(c);
    o += c.length * 2;
  }
  return new Blob([buf], { type: 'audio/wav' });
}

async function transcribe(blob: Blob, signal?: AbortSignal): Promise<string> {
  const fd = new FormData();
  fd.append('file', blob, 'diktat.wav');
  fd.append('model', await getAsrModel());
  fd.append('response_format', 'json');
  const res = await fetch('/asr/audio/transcriptions', { method: 'POST', body: fd, signal });
  if (!res.ok) throw new Error(`Transkription fehlgeschlagen: HTTP ${res.status}`);
  const data = (await res.json()) as { text?: string };
  return (data.text ?? '').trim();
}

/** Diagnose im Server-Fenster („[Add-in] Diktat: …“) */
function log(msg: string) {
  fetch('/log', { method: 'POST', body: `Diktat: ${msg}` }).catch(() => {});
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${what}: Zeitüberschreitung`)), ms))]);
}

/** Office im Browser verlangt eine eigene Freigabe (Office.devicePermission). In der
 *  Desktop-App gibt es diese API nicht – dort fragt Windows/Office beim Mikrofonzugriff
 *  selbst nach. Nach der ERSTEN Freigabe muss das Add-in neu geladen werden. */
async function officeWebPermission(): Promise<'ok' | 'reload'> {
  const o = window.Office;
  if (o?.context?.platform !== o?.PlatformType?.OfficeOnline) return 'ok';
  const dp = o?.devicePermission;
  if (!dp?.requestPermissions) return 'ok';
  const firstTime = await withTimeout<boolean>(dp.requestPermissions([o.DevicePermissionType.microphone]), 120_000, 'Freigabe');
  return firstTime ? 'reload' : 'ok';
}

export function useDictation(onFinal: (text: string) => void) {
  const [status, setStatus] = useState<DictationStatus>('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<DictationError | null>(null);

  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  const statusRef = useRef<DictationStatus>('idle');
  statusRef.current = status;

  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const pcm = useRef<Int16Array[]>([]);
  const frames = useRef(0);
  const previewTimer = useRef<number | null>(null);
  const previewBusy = useRef(false);
  const previewAbort = useRef<AbortController | null>(null);

  const teardown = useCallback(() => {
    if (previewTimer.current) window.clearInterval(previewTimer.current);
    previewTimer.current = null;
    previewAbort.current?.abort();
    previewAbort.current = null;
    void audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    previewBusy.current = false;
  }, []);

  useEffect(() => teardown, [teardown]);

  // Fehler sind Hinweise, keine Dauerzustände
  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(id);
  }, [error]);

  const runPreview = useCallback(async () => {
    if (previewBusy.current || !pcm.current.length || statusRef.current !== 'recording') return;
    previewBusy.current = true;
    const ctrl = new AbortController();
    previewAbort.current = ctrl;
    try {
      const text = await transcribe(wavBlob(pcm.current), ctrl.signal);
      if (statusRef.current === 'recording' && text) setInterim(text);
    } catch {
      /* Vorschau ist Kosmetik */
    } finally {
      previewBusy.current = false;
      if (previewAbort.current === ctrl) previewAbort.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (statusRef.current !== 'idle') return;
    setError(null);
    setInterim('');
    if (!navigator.mediaDevices?.getUserMedia) {
      log('getUserMedia nicht verfügbar (unsichere Verbindung?)');
      setError('insecure-context');
      return;
    }
    // Audio-Engine SOFORT beim Klick anlegen: nach einem Freigabedialog gilt der Klick
    // nicht mehr als Nutzeraktion, und ein dann erzeugter AudioContext bliebe stumm.
    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
      void ctx.resume().catch(() => undefined);
    } catch (err) {
      log(`AudioContext fehlgeschlagen: ${(err as Error).message}`);
      setError('transcribe-failed');
      return;
    }
    audioCtx.current = ctx;
    statusRef.current = 'starting';
    setStatus('starting');
    const fail = (e: DictationError, msg: string) => {
      log(msg);
      teardown();
      statusRef.current = 'idle';
      setStatus('idle');
      setError(e);
    };

    try {
      if ((await officeWebPermission()) === 'reload') {
        log('Freigabe erteilt – Add-in wird neu geladen');
        window.location.reload();
        return;
      }
    } catch (err) {
      return fail('mic-denied', `Office-Freigabe verweigert: ${(err as Error).message}`);
    }

    let media: MediaStream;
    try {
      // Windows/Office fragt hier ggf. nach – großzügige Wartezeit für den Dialog
      media = await withTimeout(navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }), 120_000, 'Mikrofon');
    } catch (err) {
      const name = (err as Error).name;
      return fail(name === 'NotFoundError' ? 'no-mic' : 'mic-denied', `getUserMedia fehlgeschlagen: ${name} ${(err as Error).message}`);
    }
    if (statusRef.current !== 'starting') {
      // Während des Dialogs abgebrochen
      media.getTracks().forEach((t) => t.stop());
      return;
    }
    stream.current = media;
    const track = media.getAudioTracks()[0];
    log(`Mikrofon: ${track?.label || 'unbekannt'}, AudioContext ${ctx.state}, ${ctx.sampleRate} Hz`);

    try {
      if (ctx.state === 'suspended') await withTimeout(ctx.resume(), 3000, 'resume').catch(() => undefined);
      pcm.current = [];
      frames.current = 0;
      const push = (data: Float32Array) => {
        frames.current++;
        if (statusRef.current === 'recording') pcm.current.push(toPcm16k(data, ctx.sampleRate));
      };
      const source = ctx.createMediaStreamSource(media);
      const mute = ctx.createGain();
      mute.gain.value = 0;
      try {
        await withTimeout(ctx.audioWorklet.addModule('/pcm-capture.worklet.js'), 5000, 'Worklet');
        const node = new AudioWorkletNode(ctx, 'pcm-capture');
        node.port.onmessage = (e: MessageEvent<Float32Array>) => push(e.data);
        source.connect(node);
        node.connect(mute).connect(ctx.destination);
      } catch (err) {
        // Ersatzweg ohne AudioWorklet
        log(`AudioWorklet nicht nutzbar (${(err as Error).message}) – ScriptProcessor`);
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        proc.onaudioprocess = (e) => push(new Float32Array(e.inputBuffer.getChannelData(0)));
        source.connect(proc);
        proc.connect(mute).connect(ctx.destination);
      }
      statusRef.current = 'recording';
      setStatus('recording');
      previewTimer.current = window.setInterval(() => void runPreview(), PREVIEW_INTERVAL_MS);
      // Wächter: Kommt kein Ton an, nicht stumm „aufnehmen“, sondern melden
      window.setTimeout(() => {
        if (statusRef.current !== 'recording' || frames.current > 0) return;
        void ctx.resume().catch(() => undefined);
        window.setTimeout(() => {
          if (statusRef.current === 'recording' && frames.current === 0) fail('no-audio', `Kein Ton empfangen (AudioContext ${ctx.state}, Spur ${track?.readyState}, stumm=${track?.muted})`);
        }, 2500);
      }, 2500);
    } catch (err) {
      fail('transcribe-failed', `Aufnahme konnte nicht starten: ${(err as Error).message}`);
    }
  }, [runPreview, teardown]);

  /** Erstes Enter / Mikrofon-Klick während der Aufnahme: stoppen und Text einfügen. */
  const confirm = useCallback(() => {
    if (statusRef.current !== 'recording') return;
    statusRef.current = 'finalizing';
    setStatus('finalizing');
    const chunks = pcm.current;
    teardown();
    void (async () => {
      try {
        if (!chunks.length) {
          log('Bestätigt, aber keine Audiodaten');
          setError('no-audio');
          return;
        }
        const text = await transcribe(wavBlob(chunks));
        if (text) onFinalRef.current(text);
        else log(`Transkription leer (${chunks.length} Blöcke)`);
      } catch (err) {
        log(`Transkription fehlgeschlagen: ${(err as Error).message}`);
        setError('transcribe-failed');
      } finally {
        pcm.current = [];
        setStatus('idle');
        setInterim('');
      }
    })();
  }, [teardown]);

  const cancel = useCallback(() => {
    statusRef.current = 'idle';
    teardown();
    pcm.current = [];
    setStatus('idle');
    setInterim('');
  }, [teardown]);

  return { status, interim, error, start, confirm, cancel };
}
