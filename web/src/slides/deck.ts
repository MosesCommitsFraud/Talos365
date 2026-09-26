// Baut Folien als echte .pptx (HTML/CSS → dom-to-pptx) und setzt sie per
// insertSlidesFromBase64 in die offene Präsentation ein. Jede erzeugte Folie merkt
// sich ihre Spezifikation in einem Slide-Tag, damit das Modell sie später gezielt
// ändern kann.
import JSZip from 'jszip';
import { LAYOUTS, type SlideSpec } from './layouts';
import { resolveImageRef } from './images';
import { buildDeck } from './render';
import { hexClean, resolveDesign, type PresentationDesign, type ThemeRequest } from './styles';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const PowerPoint: any;

const SLIDE_TAG = 'TALOS_SLIDE';
const DECK_TAG = 'TALOS_THEME';

let autoDesign: PresentationDesign | null | undefined;

/** Liest Farben und Schriften aus dem Design der geöffneten Präsentation
 *  (für palette „auto“): Folie 1 exportieren, Theme-XML auswerten. */
export async function readPresentationDesign(): Promise<PresentationDesign | null> {
  if (autoDesign !== undefined) return autoDesign;
  try {
    const b64: string = await PowerPoint.run(async (ctx: any) => {
      const slides = ctx.presentation.slides;
      slides.load('items/id');
      await ctx.sync();
      if (!slides.items.length) return '';
      const res = slides.items[0].exportAsBase64();
      await ctx.sync();
      return res.value as string;
    });
    if (!b64) return (autoDesign = null);
    const zip = await JSZip.loadAsync(b64, { base64: true });
    const themeFile = Object.keys(zip.files).find((f) => /^ppt\/theme\/theme\d+\.xml$/.test(f));
    if (!themeFile) return (autoDesign = null);
    const xml = await zip.file(themeFile)!.async('string');
    const color = (name: string) => {
      const m = new RegExp(`<a:${name}>\\s*<a:(?:srgbClr val|sysClr[^>]*lastClr)="([0-9A-Fa-f]{6})"`).exec(xml);
      return m?.[1]?.toUpperCase();
    };
    const font = (kind: 'major' | 'minor') => new RegExp(`<a:${kind}Font>\\s*<a:latin typeface="([^"]+)"`).exec(xml)?.[1];
    autoDesign = {
      dark: hexClean(color('dk2'), '1E2761'),
      primary: hexClean(color('accent1'), '2F5597'),
      accent: hexClean(color('accent2'), 'ED7D31'),
      accent2: hexClean(color('accent3'), 'A5A5A5'),
      headFont: font('major')?.startsWith('+') ? undefined : font('major'),
      bodyFont: font('minor')?.startsWith('+') ? undefined : font('minor'),
    };
    return autoDesign;
  } catch {
    return (autoDesign = null);
  }
}

/** Bild-IDs („img3“) durch URL + Bildnachweis ersetzen – so bleibt die Folie auch
 *  nach einem Neustart neu baubar. Unbekannte IDs sind ein Fehler für das Modell. */
function resolveImages(spec: SlideSpec) {
  const unknown: string[] = [];
  const credits: string[] = [];
  const fix = (o: { image?: string; image_credit?: string }) => {
    if (!o.image) return;
    const r = resolveImageRef(o.image);
    if (!r) {
      unknown.push(o.image);
      delete o.image;
      return;
    }
    o.image = r.url;
    if (r.credit) o.image_credit = r.credit;
    if (o.image_credit) credits.push(o.image_credit);
  };
  fix(spec);
  for (const it of spec.items ?? []) if (it) fix(it);
  if (unknown.length) throw new Error(`Unbekannte Bild-ID(s): ${unknown.join(', ')}. Nutze IDs aus search_images (z. B. "img3") oder eine direkte Bild-URL.`);
  // Bildnachweise zusätzlich in die Sprechernotizen
  const list = [...new Set(credits)];
  if (list.length && !(spec.notes ?? '').includes('Bildnachweis')) spec.notes = `${spec.notes ? spec.notes + '\n\n' : ''}Bildnachweis: ${list.join('; ')}`;
}

function normalizeSpec(raw: unknown): SlideSpec {
  const spec = (raw && typeof raw === 'object' ? JSON.parse(JSON.stringify(raw)) : {}) as SlideSpec;
  if (!LAYOUTS.includes(spec.layout)) spec.layout = 'bullets';
  resolveImages(spec);
  return spec;
}

/** Text-Warnungen des letzten Builds (Index der Folie im Build + Meldung). */
let lastWarnings: Array<{ index: number; message: string }> = [];
export function buildWarnings() {
  return lastWarnings;
}

/** Aufgelöstes Design (inkl. Farben/Schriften der Vorlage bei style „auto“) */
export async function designFor(themeReq: ThemeRequest) {
  const wantsAuto = themeReq.style === 'auto' || themeReq.palette === 'auto';
  return resolveDesign(themeReq, wantsAuto ? await readPresentationDesign() : null);
}

export async function buildPptx(specs: SlideSpec[], themeReq: ThemeRequest, startIndex = 0): Promise<string> {
  const wantsAuto = themeReq.style === 'auto' || themeReq.palette === 'auto';
  const auto = wantsAuto ? await readPresentationDesign() : null;
  const design = resolveDesign(themeReq, auto);
  const { base64, warnings } = await buildDeck(specs, design, startIndex);
  lastWarnings = warnings;
  return base64;
}

async function slideIds(ctx: any): Promise<string[]> {
  const slides = ctx.presentation.slides;
  slides.load('items/id');
  await ctx.sync();
  return slides.items.map((s: any) => s.id as string);
}

/** Folien ohne Inhalt (z. B. die leere Titelfolie einer neuen Präsentation). */
async function blankSlideIds(ctx: any): Promise<string[]> {
  const slides = ctx.presentation.slides;
  slides.load('items/id');
  await ctx.sync();
  const blank: string[] = [];
  for (const slide of slides.items) {
    const shapes = slide.shapes;
    shapes.load('items/type');
    await ctx.sync();
    let hasContent = false;
    for (const sh of shapes.items) {
      if (!['Placeholder', 'TextBox', 'GeometricShape'].includes(sh.type)) {
        hasContent = true;
        break;
      }
      try {
        const tr = sh.textFrame.textRange;
        tr.load('text');
        await ctx.sync();
        if (tr.text.trim()) {
          hasContent = true;
          break;
        }
      } catch {
        hasContent = true;
        break;
      }
    }
    if (!hasContent) blank.push(slide.id);
  }
  return blank;
}

export interface InsertResult {
  numbers: number[];
  removedBlank: number;
  /** Automatischer Text-Check: „Folie 4: Wort zu lang …“ */
  warnings: string[];
}

/** Erzeugt Folien und setzt sie nach `afterSlide` ein (Standard: ans Ende). */
export async function createSlides(specsRaw: unknown[], themeReq: ThemeRequest, afterSlide?: number, replaceBlank = true): Promise<InsertResult> {
  const specs = specsRaw.map(normalizeSpec);
  const b64 = await buildPptx(specs, themeReq);
  return PowerPoint.run(async (ctx: any) => {
    const before = await slideIds(ctx);
    // Nur bei einer neuen, komplett leeren Präsentation die leeren Folien ersetzen –
    // absichtlich leere Folien in bestehenden Präsentationen bleiben.
    const blankCandidates = replaceBlank ? await blankSlideIds(ctx) : [];
    const blank = blankCandidates.length === before.length ? blankCandidates : [];
    const options: Record<string, unknown> = { formatting: 'KeepSourceFormatting' };
    const target = afterSlide && afterSlide > 0 ? before[Math.min(afterSlide, before.length) - 1] : before[before.length - 1];
    if (target) options.targetSlideId = target;
    ctx.presentation.insertSlidesFromBase64(b64, options);
    await ctx.sync();
    // Leere Ausgangsfolien entfernen, wenn neue Inhalte da sind
    for (const id of blank) ctx.presentation.slides.getItem(id).delete();
    await ctx.sync();
    const after = await slideIds(ctx);
    const newIds = after.filter((id) => !before.includes(id));
    newIds.forEach((id, i) => {
      ctx.presentation.slides.getItem(id).tags.add(SLIDE_TAG, JSON.stringify({ spec: specs[i] }));
    });
    try {
      ctx.presentation.tags.add(DECK_TAG, JSON.stringify(themeReq));
    } catch {
      /* ältere PowerPoint-Version */
    }
    await ctx.sync();
    const numbers = newIds.map((id) => after.indexOf(id) + 1);
    const warnings = buildWarnings().map((w) => `Folie ${numbers[w.index] ?? w.index + 1}: ${w.message}`);
    return { numbers, removedBlank: blank.length, warnings };
  });
}

/** Theme der Präsentation (zuletzt verwendet). */
export async function deckTheme(): Promise<ThemeRequest | null> {
  try {
    return await PowerPoint.run(async (ctx: any) => {
      const tag = ctx.presentation.tags.getItemOrNullObject(DECK_TAG);
      tag.load('value');
      await ctx.sync();
      return tag.isNullObject ? null : JSON.parse(tag.value);
    });
  } catch {
    return null;
  }
}

export async function slideDesign(number: number): Promise<SlideSpec | null> {
  return PowerPoint.run(async (ctx: any) => {
    const ids = await slideIds(ctx);
    const id = ids[number - 1];
    if (!id) throw new Error(`Folie ${number} existiert nicht (die Präsentation hat ${ids.length} Folien).`);
    const tag = ctx.presentation.slides.getItem(id).tags.getItemOrNullObject(SLIDE_TAG);
    tag.load('value');
    await ctx.sync();
    return tag.isNullObject ? null : (JSON.parse(tag.value).spec as SlideSpec);
  });
}

/** Alle von Talos gestalteten Folien (Nummer → Spezifikation). */
export async function designedSlides(): Promise<Array<{ number: number; spec: SlideSpec }>> {
  return PowerPoint.run(async (ctx: any) => {
    const ids = await slideIds(ctx);
    const tags = ids.map((id) => {
      const t = ctx.presentation.slides.getItem(id).tags.getItemOrNullObject(SLIDE_TAG);
      t.load('value');
      return t;
    });
    await ctx.sync();
    const out: Array<{ number: number; spec: SlideSpec }> = [];
    tags.forEach((t: any, i: number) => {
      if (!t.isNullObject) out.push({ number: i + 1, spec: JSON.parse(t.value).spec });
    });
    return out;
  });
}

/** Ersetzt Folie `number` durch eine neu gestaltete Folie. Die neue Spezifikation
 *  wird mit der bisherigen zusammengeführt: Felder, die das Modell weglässt (z. B.
 *  `layout`), bleiben erhalten – so zerstört eine Teilkorrektur nie die Folie. */
export async function replaceSlide(number: number, specRaw: unknown, themeReq: ThemeRequest): Promise<{ warnings: string[] }> {
  const previous = await slideDesign(number).catch(() => null);
  const patch = (specRaw && typeof specRaw === 'object' ? specRaw : {}) as Partial<SlideSpec>;
  const spec = normalizeSpec({ ...(previous ?? {}), ...patch });
  // Gleicher Index wie vorher → Hintergrund-Formen stehen an derselben Stelle (Morph)
  const b64 = await buildPptx([spec], themeReq, number - 1);
  const warnings = buildWarnings()
    .filter((w) => !w.message.startsWith('Gleiches Layout'))
    .map((w) => `Folie ${number}: ${w.message}`);
  await PowerPoint.run(async (ctx: any) => {
    const before = await slideIds(ctx);
    const oldId = before[number - 1];
    if (!oldId) throw new Error(`Folie ${number} existiert nicht (die Präsentation hat ${before.length} Folien).`);
    ctx.presentation.insertSlidesFromBase64(b64, { formatting: 'KeepSourceFormatting', targetSlideId: oldId });
    await ctx.sync();
    const after = await slideIds(ctx);
    const newId = after.find((id) => !before.includes(id));
    ctx.presentation.slides.getItem(oldId).delete();
    if (newId) ctx.presentation.slides.getItem(newId).tags.add(SLIDE_TAG, JSON.stringify({ spec }));
    await ctx.sync();
  });
  return { warnings };
}

/** Bilder der Folien (PNG, data-URL) für den Selbstcheck. */
export async function slideImages(numbers: number[], width = 800): Promise<Array<{ number: number; url: string }>> {
  return PowerPoint.run(async (ctx: any) => {
    const ids = await slideIds(ctx);
    const results = numbers
      .filter((n) => ids[n - 1])
      .map((n) => ({ n, res: ctx.presentation.slides.getItem(ids[n - 1]).getImageAsBase64({ width }) }));
    await ctx.sync();
    return results.map(({ n, res }: { n: number; res: { value: string } }) => ({ number: n, url: `data:image/png;base64,${res.value}` }));
  });
}
