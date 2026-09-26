// Auswahl im Dokument: Folien/Formen (PowerPoint), Text (Word), Zellbereich (Excel).
// Zurückhaltend: Sie erscheint nur, wenn der Nutzer im Dokument aktiv etwas auswählt
// (Ereignis „Auswahl geändert“) – nicht beim Öffnen, nicht für die bloß offene Folie und
// nicht, während das Modell arbeitet. Mitgeschickt wird genau die Auswahl von diesem
// Moment; nach dem Senden ist sie verbraucht.
import { create } from 'zustand';
import type { Attachment } from '@/agent';
import { useChat } from '@/state/chat';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const PowerPoint: any;
declare const Word: any;
declare const Excel: any;

export interface SelectionInfo {
  label: string;
}

interface SelectionState {
  info: SelectionInfo | null;
  set: (info: SelectionInfo | null) => void;
}

export const useSelection = create<SelectionState>()((set) => ({
  info: null,
  set: (info) => set({ info }),
}));

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
const quote = (s: string, n = 32) => `„${clip(s.replace(/\s+/g, ' ').trim(), n)}“`;

/** Momentaufnahme der Auswahl (für das Senden) */
let snapshot: (() => Promise<Attachment | null>) | null = null;

// ── PowerPoint ─────────────────────────────────────────────────────────────

interface PptSelection {
  slides: number[];
  slideIds: string[];
  shapes: Array<{ id: string; name: string; type: string; text?: string; left: number; top: number; width: number; height: number }>;
  text: string;
}

async function readPowerPoint(): Promise<PptSelection> {
  return PowerPoint.run(async (ctx: any) => {
    const all = ctx.presentation.slides;
    all.load('items/id');
    const selSlides = ctx.presentation.getSelectedSlides();
    selSlides.load('items/id');
    const selShapes = ctx.presentation.getSelectedShapes();
    selShapes.load('items/id,items/name,items/type,items/left,items/top,items/width,items/height');
    await ctx.sync();
    const ids: string[] = all.items.map((s: any) => s.id);
    const slideIds: string[] = selSlides.items.map((s: any) => s.id);
    const slides = slideIds.map((id) => ids.indexOf(id) + 1).filter((n) => n > 0);
    const shapes = [] as PptSelection['shapes'];
    for (const sh of selShapes.items) {
      let text: string | undefined;
      try {
        const tr = sh.textFrame.textRange;
        tr.load('text');
        await ctx.sync();
        text = tr.text || undefined;
      } catch {
        /* Form ohne Text */
      }
      shapes.push({ id: sh.id, name: sh.name, type: sh.type, text, left: Math.round(sh.left), top: Math.round(sh.top), width: Math.round(sh.width), height: Math.round(sh.height) });
    }
    let text = '';
    try {
      const tr = ctx.presentation.getSelectedTextRange();
      tr.load('text');
      await ctx.sync();
      text = tr.text ?? '';
    } catch {
      /* kein Text ausgewählt */
    }
    return { slides, slideIds, shapes, text };
  });
}

function pptLabel(s: PptSelection): string | null {
  if (!s.slides.length) return null;
  const where = s.slides.length === 1 ? `Folie ${s.slides[0]}` : `Folien ${s.slides.join(', ')}`;
  if (s.text.trim()) return `${quote(s.text)} auf ${where} ausgewählt`;
  if (s.shapes.length === 1) return `${s.shapes[0].text ? quote(s.shapes[0].text, 28) : s.shapes[0].name} auf ${where} ausgewählt`;
  if (s.shapes.length > 1) return `${s.shapes.length} Elemente auf ${where} ausgewählt`;
  return `${where} ausgewählt`;
}

async function pptAttachment(s: PptSelection, label: string): Promise<Attachment> {
  const lines: string[] = [];
  lines.push(`Ausgewählte Folie(n): ${s.slides.join(', ')}`);
  if (s.shapes.length) {
    lines.push('Ausgewählte Elemente (Koordinaten in pt):');
    for (const sh of s.shapes) lines.push(`- id=${sh.id} name="${sh.name}" typ=${sh.type} pos=${sh.left},${sh.top} größe=${sh.width}×${sh.height}${sh.text ? ` text=${JSON.stringify(clip(sh.text, 400))}` : ''}`);
  }
  if (s.text) lines.push(`Ausgewählter Text: ${JSON.stringify(clip(s.text, 2000))}`);
  // Bild der ausgewählten Folien (max. 3), damit das Modell sieht, worum es geht
  const images: Attachment['images'] = [];
  try {
    const pics = await PowerPoint.run(async (ctx: any) => {
      const res = s.slideIds.slice(0, 3).map((id) => ctx.presentation.slides.getItem(id).getImageAsBase64({ width: 960 }));
      await ctx.sync();
      return res.map((r: any) => r.value as string);
    });
    pics.forEach((b64: string, i: number) => images.push({ label: `Ausgewählte Folie ${s.slides[i]}`, url: `data:image/png;base64,${b64}` }));
  } catch {
    /* Folie inzwischen gelöscht oder ältere PowerPoint-Version: nur Text */
  }
  return { label, context: lines.join('\n'), images };
}

// ── Word ───────────────────────────────────────────────────────────────────

async function readWord(): Promise<string> {
  return Word.run(async (ctx: any) => {
    const sel = ctx.document.getSelection();
    sel.load('text');
    await ctx.sync();
    return (sel.text ?? '').trim();
  });
}

// ── Excel ──────────────────────────────────────────────────────────────────

interface XlSelection {
  address: string;
  rows: number;
  cols: number;
  values: unknown[][];
}

async function readExcel(): Promise<XlSelection> {
  return Excel.run(async (ctx: any) => {
    const r = ctx.workbook.getSelectedRange();
    r.load('address,rowCount,columnCount');
    await ctx.sync();
    const small = r.rowCount * r.columnCount <= 400 ? r : r.getCell(0, 0).getResizedRange(Math.min(r.rowCount, 20) - 1, Math.min(r.columnCount, 20) - 1);
    small.load('values');
    await ctx.sync();
    return { address: r.address, rows: r.rowCount, cols: r.columnCount, values: small.values };
  });
}

// ── Ablauf ──────────────────────────────────────────────────────────────────

interface Capture {
  /** Schlüssel der Auswahl (zum Vergleich mit dem Ausgangszustand) */
  key: string;
  label: string | null;
  build: (() => Promise<Attachment | null>) | null;
}

/** Aktuelle Auswahl lesen (ohne sie anzuzeigen). */
async function capture(host: string): Promise<Capture | null> {
  if (host === 'PowerPoint') {
    const s = await readPowerPoint();
    const label = pptLabel(s);
    return { key: `${s.slideIds.join(',')}|${s.shapes.map((x) => x.id).join(',')}|${s.text}`, label, build: label ? () => pptAttachment(s, label) : null };
  }
  if (host === 'Word') {
    const text = await readWord();
    if (!text) return { key: '', label: null, build: null };
    const words = text.split(/\s+/).length;
    const label = words > 6 ? `${quote(text)} ausgewählt · ${words} Wörter` : `${quote(text)} ausgewählt`;
    return { key: text, label, build: async () => ({ label, context: `Ausgewählter Text:\n${clip(text, 8000)}` }) };
  }
  if (host === 'Excel') {
    const s = await readExcel();
    const single = s.rows * s.cols === 1;
    const empty = single && (s.values?.[0]?.[0] === '' || s.values?.[0]?.[0] == null);
    if (empty) return { key: s.address, label: null, build: null };
    const label = `${s.address.replace(/^.*!/, '')} ausgewählt${single ? '' : ` · ${s.rows}×${s.cols}`}`;
    const tsv = s.values.map((row) => row.map((v) => String(v ?? '')).join('\t')).join('\n');
    const partial = s.rows * s.cols > 400 ? ' (Ausschnitt der ersten 20×20 Zellen)' : '';
    return { key: s.address, label, build: async () => ({ label, context: `Ausgewählter Bereich: ${s.address} (${s.rows} Zeilen × ${s.cols} Spalten)\nWerte${partial}:\n${tsv}` }) };
  }
  return null;
}

/** Ausgangszustand: Was beim Öffnen (oder nach der Arbeit des Modells) ausgewählt ist,
 *  gilt nicht als Auswahl des Nutzers. Erst eine Änderung davon zeigt die Leiste. */
let baseline: string | null = null;

async function setBaseline(host: string) {
  try {
    baseline = (await capture(host))?.key ?? null;
  } catch {
    baseline = null;
  }
}

async function onUserSelection(host: string) {
  try {
    const c = await capture(host);
    if (!c || c.key === baseline) return;
    baseline = c.key;
    snapshot = c.build;
    useSelection.getState().set(c.label ? { label: c.label } : null);
  } catch {
    /* Auswahl nicht lesbar */
  }
}

/** Auswahl verwerfen (× in der Leiste). */
export function clearSelection() {
  snapshot = null;
  useSelection.getState().set(null);
}

/** Beim Senden: die gezeigte Auswahl als Anhang – danach ist sie verbraucht. */
export async function selectionAttachment(): Promise<Attachment | null> {
  if (!useSelection.getState().info || !snapshot) return null;
  const take = snapshot;
  clearSelection();
  try {
    return await take();
  } catch {
    return null;
  }
}

/** Nur auf aktive Auswahländerungen des Nutzers hören. */
export function watchSelection(host: string | null): () => void {
  if (!host || !window.Office?.context?.document) return () => {};
  let timer: number | undefined;
  let ready = false;
  // Beim Öffnen: aktuellen Zustand still merken, nichts anzeigen
  void setBaseline(host).then(() => (ready = true));
  const onChange = () => {
    window.clearTimeout(timer);
    // Während das Modell arbeitet, ändert es selbst die Auswahl (neue Folien) – ignorieren
    if (!ready || useChat.getState().streaming) return;
    timer = window.setTimeout(() => {
      if (!useChat.getState().streaming) void onUserSelection(host);
    }, 300);
  };
  try {
    window.Office.context.document.addHandlerAsync(window.Office.EventType.DocumentSelectionChanged, onChange);
  } catch {
    /* nicht unterstützt */
  }
  // Nach jeder Arbeit des Modells den Ausgangszustand neu setzen
  const unsub = useChat.subscribe((s, prev) => {
    if (prev.streaming && !s.streaming) {
      ready = false;
      window.setTimeout(() => void setBaseline(host).then(() => (ready = true)), 600);
    }
  });
  return () => {
    window.clearTimeout(timer);
    unsub();
    try {
      window.Office.context.document.removeHandlerAsync(window.Office.EventType.DocumentSelectionChanged, { handler: onChange });
    } catch {
      /* egal */
    }
  };
}
