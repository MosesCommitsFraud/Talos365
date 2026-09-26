// Agent-Loop: streamt die Modellantwort (OpenAI-kompatibel, SSE), führt die
// angeforderten Office-Werkzeuge aus und wiederholt, bis das Modell fertig ist.
// Der Verlauf landet im Chat-Store in derselben Form, die Talos rendert.
import { newId, useChat } from '@/state/chat';
import { usePrefs } from '@/state/prefs';
import type { Citation, HostToolset, ToolCall, UiMessage } from '@/lib/types';
import { resetCitations, skillsPrompt } from '@/talos';
import { chatTitle, useHistory } from '@/state/history';
import { useBrand } from '@/lib/brand';
import { extractQuestions, resetAsked } from '@/lib/ask';

const MAX_TOOL_RESULT_CHARS = 12000;
const READ_ONLY = /^(get_|read_|list_)/;

interface ApiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}
type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
type ApiMessage =
  | { role: 'system' | 'user'; content: string | ContentPart[] }
  | { role: 'assistant'; content: string; tool_calls?: ApiToolCall[] }
  | { role: 'tool'; tool_call_id: string; name: string; content: string };

let history: ApiMessage[] = [];
let abort: AbortController | null = null;
/** Id der laufenden Unterhaltung im Chatverlauf */
let chatId: string | null = null;
let chatHost = '';

export function resetConversation() {
  abort?.abort();
  history = [];
  chatId = null;
  resetAsked();
  resetCitations();
  useChat.getState().reset();
  useHistory.getState().setCurrent(null);
}

/** Gespeicherte Unterhaltung wieder öffnen – Anzeige und Modellverlauf. */
export function openConversation(id: string) {
  const saved = useHistory.getState().chats.find((c) => c.id === id);
  if (!saved || useChat.getState().streaming) return;
  abort?.abort();
  history = saved.api as ApiMessage[];
  chatId = saved.id;
  chatHost = saved.host;
  // Geladener Chat: nicht erneut mit Pflicht-Rückfragen beginnen
  resetAsked(saved.messages.length > 0);
  resetCitations(saved.messages.flatMap((m) => m.citations ?? []));
  useChat.getState().reset();
  for (const m of saved.messages) useChat.getState().addMessage(m);
  useHistory.getState().setCurrent(saved.id);
}

function saveConversation(host: string) {
  const messages = useChat.getState().messages;
  if (!messages.length) return;
  chatId ??= newId('c');
  chatHost ||= host;
  useHistory.getState().save({ id: chatId, title: chatTitle(messages), host: chatHost, updatedAt: Date.now(), messages: messages as UiMessage[], api: history });
}

/** Werkzeuge nach den Schaltern im „+“-Menü (Websuche, Wissensdatenbank). */
function activeTools(ts: HostToolset) {
  const { useWeb, useRag } = usePrefs.getState();
  return ts.tools.filter(
    (t) => (useWeb || !['web_search', 'web_fetch'].includes(t.name)) && (useRag || t.name !== 'knowledge_search'),
  );
}

export function stopTurn() {
  abort?.abort();
  useChat.getState().pendingConfirm?.resolve(false);
}

function endpointUrl(path: string) {
  return usePrefs.getState().endpoint.replace(/\/+$/, '') + path;
}

function remoteLog(text: string) {
  fetch('/log', { method: 'POST', body: text }).catch(() => {});
}

/** fetch mit einem Wiederholversuch bei Netzwerkfehlern und verständlicher Meldung. */
async function fetchWithRetry(url: string, options?: RequestInit): Promise<Response> {
  if (location.protocol === 'https:' && /^http:\/\//i.test(url)) {
    throw new Error(
      `Der Endpunkt ${url} ist eine http-Adresse – die blockiert Office aus Sicherheitsgründen. Trage in den Einstellungen „/llm“ ein (der lokale Server leitet weiter).`,
    );
  }
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      const detail = `${options?.method || 'GET'} ${url} fehlgeschlagen (Versuch ${attempt}): ${(err as Error).message}`;
      remoteLog(detail);
      if (attempt >= 2) throw new Error(`${detail}. Läuft „npm.cmd start“ noch?`);
    }
  }
}

export async function fetchModels(): Promise<string[]> {
  const res = await fetchWithRetry(endpointUrl('/models'));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || res.statusText);
  return ((data.data ?? []) as Array<{ id: string }>).map((m) => m.id).sort();
}

/** Skill-Übersicht (Talos + lokale Ordner) – einmal pro Auftrag geladen. */
let currentSkillsPrompt = '';

function systemPrompt(ts: HostToolset) {
  const { useWeb } = usePrefs.getState();
  return `Du bist ${useBrand.getState().name}, ein KI-Assistent, der direkt in Microsoft ${ts.label} arbeitet. Du kannst das geöffnete Dokument mit Werkzeugen (Tools) lesen und bearbeiten.

Was du alles kannst (nutze es, wenn es dem Auftrag hilft – nichts davon ist Pflicht):
- Das Dokument lesen und direkt bearbeiten (Werkzeuge der App).
- Im Internet recherchieren (web_search, web_fetch) und die Wissensdatenbank durchsuchen (knowledge_search), sofern im „+“-Menü eingeschaltet.
- Skills lesen (list_skills, read_skill) – geprüfte Arbeitsanleitungen.
- Rückfragen mit anklickbaren Antworten stellen (ask_user).
- In PowerPoint zusätzlich: gestaltete Folien in 17 Stilen und 40 Layouts mit Varianten, Illustrationen, Icons, echten Diagrammen und optionalen Fotos (search_images) erstellen; Folien als Bild prüfen (review_slides) und die Einheitlichkeit prüfen (check_deck).
- Hat der Nutzer etwas im Dokument ausgewählt, steht es in seiner Nachricht (in PowerPoint mit Bild der Folie).

Arbeitsweise:
- Verschaffe dir mit den Lese-Werkzeugen einen Überblick, bevor du etwas änderst.
- Führe Änderungen selbst mit den Werkzeugen aus, statt dem Nutzer Anleitungen zu geben.
- Verwende nur IDs, Nummern und Namen, die dir ein Werkzeug geliefert hat – erfinde nichts.
- Meldet ein Werkzeug einen Fehler, lies die Meldung, korrigiere die Parameter und versuche es erneut.
- Erfinde keine Fakten oder Zahlen. Fehlen Inhalte, nutze neutrale Platzhalter oder frage nach.
- Wenn alles erledigt ist, fasse kurz zusammen, was du geändert hast.
- Antworte in der Sprache des Nutzers, knapp und freundlich.

${ts.prompt}${useWeb ? '' : '\n\nDie Websuche ist vom Nutzer ausgeschaltet. Recherchiere nicht im Internet; sag bei Bedarf, dass sie im „+“-Menü eingeschaltet werden kann.'}`;
}

/** Nur die jüngste Bildnachricht behält ihre Bilder – ältere Selbstcheck-Bilder
 *  werden durch einen Hinweis ersetzt, sonst läuft der Kontext voll. */
function withLatestImagesOnly(messages: ApiMessage[]): ApiMessage[] {
  const lastImage = messages.map((m) => Array.isArray(m.content)).lastIndexOf(true);
  return messages.map((m, i) => {
    if (!Array.isArray(m.content) || i === lastImage) return m;
    // Text behalten (z. B. die Nutzernachricht mit Markierung), nur die Bilder entfernen
    const text = m.content
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('\n');
    return { ...m, content: `${text}\n[Bilder entfernt – ältere Ansicht]` } as ApiMessage;
  });
}

/** Trennt `<think>…</think>` aus dem Inhalt, falls der Server die Gedanken nicht
 *  separat liefert. Ein noch offenes `<think>` gilt bis zum Ende als Gedanke. */
function splitThink(raw: string): { text: string; think: string } {
  let think = '';
  let text = raw.replace(/<think>([\s\S]*?)<\/think>/g, (_m, t: string) => {
    think += t;
    return '';
  });
  const open = text.indexOf('<think>');
  if (open >= 0) {
    think += text.slice(open + 7);
    text = text.slice(0, open);
  }
  return { text: text.replace(/^\s+/, ''), think };
}

interface RoundResult {
  content: string;
  calls: ApiToolCall[];
}

async function streamRound(ts: HostToolset, msgId: string, signal: AbortSignal, force?: string): Promise<RoundResult> {
  const prefs = usePrefs.getState();
  const res = await fetchWithRetry(endpointUrl('/chat/completions'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: prefs.model,
      messages: [{ role: 'system', content: systemPrompt(ts) + currentSkillsPrompt }, ...withLatestImagesOnly(history)],
      tools: activeTools(ts).map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
      // force: genau dieses Werkzeug muss aufgerufen werden (z. B. ask_user für Rückfragen)
      tool_choice: force ? { type: 'function', function: { name: force } } : 'auto',
      temperature: Number(prefs.temperature),
      stream: true,
      // Qwen3: Denkmodus an/aus (wie der Schalter im Talos-Modellmenü)
      chat_template_kwargs: { enable_thinking: force ? false : prefs.reasoning },
    }),
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || data?.detail || data?.message || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let reasoning = '';
  const calls: Array<{ id: string; name: string; args: string }> = [];

  // Store-Updates auf einen pro Frame bündeln – sonst rendert jedes Token neu.
  let scheduled = false;
  const publish = () => {
    scheduled = false;
    const { text, think } = splitThink(content);
    useChat.getState().patchMessage(msgId, { content: text, thinking: reasoning + think });
  };
  const schedule = () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(publish);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      let chunk: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }
      if (chunk.error) throw new Error(chunk.error.message || String(chunk.error));
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.reasoning) reasoning += delta.reasoning;
      if (delta.reasoning_content) reasoning += delta.reasoning_content;
      if (delta.content) content += delta.content;
      for (const tc of delta.tool_calls ?? []) {
        const i = typeof tc.index === 'number' ? tc.index : calls.length;
        calls[i] ??= { id: '', name: '', args: '' };
        if (tc.id) calls[i].id = tc.id;
        if (tc.function?.name) calls[i].name += tc.function.name;
        if (tc.function?.arguments) calls[i].args += tc.function.arguments;
      }
      schedule();
    }
  }
  publish();

  return {
    content: splitThink(content).text,
    calls: calls
      .filter(Boolean)
      .map((c, i) => ({
        id: c.id || `call_${Date.now()}_${i}`,
        type: 'function' as const,
        function: { name: c.name, arguments: c.args || '{}' },
      })),
  };
}

function officeErrorText(err: unknown): string {
  const e = err as { message?: string; code?: string; debugInfo?: { errorLocation?: string } };
  let msg = e?.message || String(err);
  if (e?.debugInfo?.errorLocation) msg += ` (bei ${e.debugInfo.errorLocation})`;
  if (e?.code && !msg.includes(e.code)) msg = `${e.code}: ${msg}`;
  return msg;
}

function askConfirm(callId: string, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      useChat.getState().setPendingConfirm(null);
      resolve(ok);
    };
    signal.addEventListener('abort', () => done(false));
    useChat.getState().setPendingConfirm({ callId, resolve: done });
  });
}

type ToolImage = { label?: string; url: string };

/** Führt ein Werkzeug aus. Bilder im Ergebnis (`__images`) werden abgetrennt:
 *  Sie erscheinen im Chat an der Werkzeugzeile und gehen als Bildnachricht ans Modell. */
async function runTool(ts: HostToolset, msgId: string, call: ApiToolCall, signal: AbortSignal): Promise<{ result: unknown; images: ToolImage[]; imagePrompt?: string; asked?: boolean }> {
  let raw = await runToolRaw(ts, msgId, call, signal);
  // Rückfrage: an die Nachricht hängen (Karte über dem Eingabefeld), der Auftrag endet danach
  if (raw && typeof raw === 'object' && Array.isArray((raw as { __ask?: unknown }).__ask)) {
    const { __ask, ...rest } = raw as { __ask: UiMessage['ask'] };
    useChat.getState().patchMessage(msgId, { ask: __ask, askDone: false });
    useChat.getState().patchTool(msgId, call.id, { output: JSON.stringify(rest, null, 2) });
    return { result: rest, images: [], asked: true };
  }
  // Nummerierte Quellen (`__citations`) an die Nachricht hängen, dem Modell nur den Text geben
  if (raw && typeof raw === 'object' && Array.isArray((raw as { __citations?: unknown }).__citations)) {
    const { __citations, text } = raw as { __citations: Citation[]; text: string };
    useChat.getState().patchMessage(msgId, (m) => ({ citations: [...(m.citations ?? []), ...__citations] }));
    useChat.getState().patchTool(msgId, call.id, { output: text });
    raw = text;
  }
  if (raw && typeof raw === 'object' && Array.isArray((raw as { __images?: unknown }).__images)) {
    const { __images, __imagePrompt, ...rest } = raw as { __images: ToolImage[]; __imagePrompt?: string };
    useChat.getState().patchTool(msgId, call.id, { images: __images, output: JSON.stringify(rest, null, 2) });
    return { result: rest, images: __images, imagePrompt: __imagePrompt };
  }
  return { result: raw, images: [] };
}

async function runToolRaw(ts: HostToolset, msgId: string, call: ApiToolCall, signal: AbortSignal): Promise<unknown> {
  const chat = useChat.getState();
  const name = call.function.name;
  const view: ToolCall = { id: call.id, tool: name, command: call.function.arguments, status: 'running' };
  chat.patchMessage(msgId, (m) => ({ tools: [...(m.tools ?? []), view] }));
  const finish = (ok: boolean, result: unknown) => {
    const output = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    useChat.getState().patchTool(msgId, call.id, { status: ok ? 'done' : 'error', output });
  };

  try {
    let args: Record<string, unknown> = {};
    try {
      args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
    } catch {
      throw new Error(`Ungültiges JSON in den Tool-Argumenten: ${call.function.arguments}`);
    }
    // Hübsch formatiert für die aufgeklappte Zeile
    useChat.getState().patchTool(msgId, call.id, { command: JSON.stringify(args, null, 2) });
    const tools = activeTools(ts);
    const tool = tools.find((t) => t.name === name);
    if (!tool) throw new Error(`Unbekanntes Werkzeug '${name}'. Verfügbar: ${tools.map((t) => t.name).join(', ')}`);
    if (usePrefs.getState().confirmWrites && !READ_ONLY.test(name)) {
      const ok = await askConfirm(call.id, signal);
      if (!ok) {
        finish(false, 'Vom Nutzer abgelehnt.');
        return { error: 'Der Nutzer hat diese Aktion abgelehnt. Frage nach, was stattdessen gewünscht ist.' };
      }
    }
    const result = (await tool.run(args)) ?? { ok: true };
    finish(true, result);
    return result;
  } catch (err) {
    const msg = officeErrorText(err);
    finish(false, msg);
    return { error: msg };
  }
}

/** Markierung im Dokument, die mit einer Nachricht mitgeht */
export interface Attachment {
  /** Kurzform für den Chip, z. B. „Folie 3 · 2 Elemente“ */
  label: string;
  /** Beschreibung für das Modell */
  context: string;
  /** Bilder (z. B. die markierte Folie), damit das Modell sieht, worum es geht */
  images?: ToolImage[];
}

export async function runAgent(text: string, ts: HostToolset | null, attachment?: Attachment | null, display?: string) {
  const chat = useChat.getState();
  if (chat.streaming) return;
  for (const m of chat.messages) if (m.ask && !m.askDone) chat.patchMessage(m.id, { askDone: true });
  // display: was der Nutzer getippt hat (z. B. „/analysis“), text: Anweisung fürs Modell
  chat.addMessage({ id: newId('u'), role: 'user', content: display ?? text, createdAt: Date.now(), ...(attachment ? { selection: attachment.label } : {}) });

  if (!ts) {
    chat.addMessage({
      id: newId('a'),
      role: 'assistant',
      content: 'Dieses Add-in läuft nur in Word, PowerPoint oder Excel.',
      error: true,
      createdAt: Date.now(),
    });
    return;
  }

  if (attachment) {
    const withSel = `${text}\n\n[Markierung im Dokument – darauf bezieht sich die Nachricht]\n${attachment.context}`;
    history.push({
      role: 'user',
      content: attachment.images?.length
        ? [{ type: 'text', text: withSel }, ...attachment.images.flatMap((img): ContentPart[] => [{ type: 'text', text: img.label ?? 'Markierung' }, { type: 'image_url', image_url: { url: img.url } }])]
        : withSel,
    });
  } else {
    history.push({ role: 'user', content: text });
  }
  ts.onTurnStart?.();
  const controller = new AbortController();
  abort = controller;
  const started = Date.now();
  chat.setStreaming(true);
  // Skills sind optional – ist Talos nicht erreichbar, geht es ohne weiter
  currentSkillsPrompt = await skillsPrompt().catch(() => '');
  const roundIds: string[] = [];
  const addAssistant = (patch: Partial<Parameters<typeof chat.addMessage>[0]> = {}) => {
    const id = newId('a');
    roundIds.push(id);
    useChat.getState().addMessage({
      id,
      role: 'assistant',
      content: '',
      thinking: '',
      tools: [],
      streaming: true,
      createdAt: Date.now(),
      ...patch,
    });
    return id;
  };

  try {
    const maxSteps = Math.max(1, Number(usePrefs.getState().maxSteps) || 60);
    let finished = false;
    let forceNext: string | undefined;
    let corrected = false;
    let hiddenText = '';
    for (let step = 0; step < maxSteps && !finished; step++) {
      const id = addAssistant();
      const force = forceNext;
      forceNext = undefined;
      let round: RoundResult;
      try {
        round = await streamRound(ts, id, controller.signal, force);
      } catch (err) {
        if (!force || (err as Error).name === 'AbortError') throw err;
        // Erzwungener Aufruf nicht möglich → Fragen wenigstens als Text zeigen
        remoteLog(`Erzwungenes ${force} fehlgeschlagen: ${(err as Error).message}`);
        useChat.getState().patchMessage(id, { content: hiddenText });
        finished = true;
        break;
      }
      const { content, calls } = round;
      history.push({ role: 'assistant', content, ...(calls.length ? { tool_calls: calls } : {}) });
      if (!calls.length) {
        // Rückfragen als Text geschrieben? → in die Rückfrage-Karte umwandeln, Auftrag endet
        const asked = ts.tools.some((t) => t.name === 'ask_user') ? extractQuestions(content) : null;
        if (asked) {
          useChat.getState().patchMessage(id, { content: asked.intro, ask: asked.questions, askDone: false });
          resetAsked(true);
          finished = true;
          break;
        }
        // Frage im Text, aber kein ask_user? → Text ausblenden und eine Runde anhängen, in der
        // das Modell ask_user aufrufen MUSS. So erscheint die Rückfrage immer als Popup.
        const qLine = content.split('\n').findIndex((l) => /\?\s*(\*\*|__)?\s*$/.test(l.trim()));
        if (qLine >= 0 && !corrected && ts.tools.some((t) => t.name === 'ask_user')) {
          corrected = true;
          hiddenText = content;
          useChat.getState().patchMessage(id, { content: content.split('\n').slice(0, qLine).join('\n').trim() });
          history.push({
            role: 'user',
            content: 'Stelle die Frage(n) aus deiner letzten Antwort jetzt über das Werkzeug ask_user – gebündelt, je Frage 2–4 kurze Antwortoptionen. Kein weiterer Text.',
          });
          forceNext = 'ask_user';
          continue;
        }
        // Fehlt noch etwas (z. B. der Selbstcheck neuer Folien)? Dann weiterarbeiten lassen.
        const missing = ts.finishCheck?.();
        if (missing) {
          history.push({ role: 'user', content: missing });
          continue;
        }
        finished = true;
        break;
      }
      const images: ToolImage[] = [];
      const prompts: string[] = [];
      let asked = false;
      for (const call of calls) {
        if (controller.signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
        const { result, images: produced, imagePrompt, asked: isAsk } = await runTool(ts, id, call, controller.signal);
        if (isAsk) asked = true;
        images.push(...produced);
        if (produced.length && imagePrompt) prompts.push(imagePrompt);
        let out = typeof result === 'string' ? result : JSON.stringify(result);
        if (out.length > MAX_TOOL_RESULT_CHARS) out = out.slice(0, MAX_TOOL_RESULT_CHARS) + '… [gekürzt]';
        history.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: out });
      }
      if (asked) {
        // Rückfrage gestellt: Auftrag endet, die Antwort kommt als nächste Nachricht
        finished = true;
        break;
      }
      if (images.length) {
        // Werkzeug-Ergebnisse sind reiner Text – Bilder gehen als eigene Nachricht ans Modell.
        history.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompts.join('\n\n') || 'Hier sind die Bilder aus den Werkzeugen. Prüfe sie kritisch und arbeite weiter.',
            },
            ...images.flatMap((img): ContentPart[] => [
              { type: 'text', text: img.label ?? 'Folie' },
              { type: 'image_url', image_url: { url: img.url } },
            ]),
          ],
        });
      }
    }
    if (!finished) {
      addAssistant({
        content: `Maximale Anzahl von ${maxSteps} Schritten erreicht. Schreib „weiter“, um fortzufahren.`,
        error: true,
      });
    }
  } catch (err) {
    const aborted = (err as Error).name === 'AbortError';
    if (!aborted) remoteLog(`Fehler im Agent-Loop: ${(err as Error).stack || (err as Error).message}`);
    addAssistant({ content: aborted ? 'Abgebrochen.' : `Fehler: ${(err as Error).message}`, error: true });
  } finally {
    const s = useChat.getState();
    const last = roundIds[roundIds.length - 1];
    for (const id of roundIds) {
      s.patchMessage(id, id === last ? { streaming: false, turnElapsedMs: Date.now() - started } : { streaming: false });
    }
    s.setPendingConfirm(null);
    s.setStreaming(false);
    if (abort === controller) abort = null;
    saveConversation(ts.label);
  }
}
