// Prüfschritte für Lesbarkeit und Einheitlichkeit – laufen bei jedem Bau automatisch:
// 1. Kontrast: Jeder Text und jedes Icon wird gegen den tatsächlichen Untergrund an seiner
//    Stelle gemessen (Karten, Farbflächen, Verläufe, auch halbtransparent). Zu schwach →
//    Farbe wird automatisch abgedunkelt/aufgehellt, bis sie lesbar ist (WCAG 4,5:1 bzw. 3:1).
// 2. Titelgrößen: Titel der Inhaltsfolien bekommen eine einheitliche Größe.
// 3. Einheitlichkeit über das Deck: Überzeilen, Satzzeichen, Titellängen, Layout-Mix.
import type { SlideSpec } from './layouts';

export interface Warning {
  index: number;
  message: string;
}

type RGB = [number, number, number];
type RGBA = [number, number, number, number];

const HERO = new Set(['title', 'section', 'statement', 'big_number', 'quote', 'closing', 'image_hero', 'image_stat', 'image_quote', 'giant']);

const short = (s: string) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > 48 ? `${t.slice(0, 48)}…` : t;
};

function parseRgb(s: string): RGBA | null {
  const m = /rgba?\(([^)]+)\)/.exec(s);
  if (!m) return null;
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (p.length < 3 || p.slice(0, 3).some((x) => Number.isNaN(x))) return null;
  return [p[0], p[1], p[2], p.length > 3 && !Number.isNaN(p[3]) ? p[3] : 1];
}

const lum = ([r, g, b]: RGB) => {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
export const contrast = (a: RGB, b: RGB) => {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const blend = (top: RGBA, bottom: RGB): RGB => [0, 1, 2].map((i) => top[i] * top[3] + bottom[i] * (1 - top[3])) as RGB;
const toCss = (c: RGB) => `rgb(${c.map((v) => Math.round(v)).join(',')})`;
const toHex = (c: RGB) => c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
const mixTo = (c: RGB, t: RGB, k: number): RGB => [0, 1, 2].map((i) => c[i] + (t[i] - c[i]) * k) as RGB;

interface Layer {
  el: Element;
  rect: DOMRect;
  /** null = Foto (Untergrund unbekannt, Abdunklung sorgt für Lesbarkeit) */
  colors: RGBA[] | null;
}

/** Alle Flächen einer Folie mit sichtbarem Hintergrund, in Zeichenreihenfolge. */
function layersOf(slide: HTMLElement): Layer[] {
  const out: Layer[] = [];
  const all = [slide, ...Array.from(slide.querySelectorAll<HTMLElement>('*'))];
  for (const el of all) {
    if (el instanceof SVGElement) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.tagName === 'IMG') {
      out.push({ el, rect: el.getBoundingClientRect(), colors: null });
      continue;
    }
    const colors: RGBA[] = [];
    if (cs.backgroundImage && cs.backgroundImage.includes('gradient')) {
      for (const m of cs.backgroundImage.matchAll(/rgba?\([^)]+\)/g)) {
        const c = parseRgb(m[0]);
        if (c) colors.push(c);
      }
    }
    const bg = parseRgb(cs.backgroundColor);
    if (!colors.length && bg && bg[3] > 0.02) colors.push(bg);
    if (colors.length) out.push({ el, rect: el.getBoundingClientRect(), colors });
  }
  return out;
}

/** Mögliche Untergrundfarben an einem Punkt unter dem Element (null = liegt auf Foto). */
function backgroundsAt(layers: Layer[], target: Element, x: number, y: number): RGB[] | null {
  let bgs: RGB[] = [[255, 255, 255]];
  for (const l of layers) {
    // Das Element selbst und alles darin ist kein Untergrund
    if (l.el === target || target.contains(l.el)) continue;
    const below = l.el.contains(target) || (l.el.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    if (!below) continue;
    const r = l.rect;
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    if (!l.colors) return null;
    const next: RGB[] = [];
    for (const b of bgs) for (const c of l.colors) next.push(blend(c, b));
    // Nur die hellste und dunkelste Möglichkeit behalten
    next.sort((p, q) => lum(p) - lum(q));
    bgs = next.length > 2 ? [next[0], next[next.length - 1]] : next;
  }
  return bgs;
}

/** Farbe so weit Richtung Schwarz oder Weiß schieben, bis sie gegen alle Untergründe reicht. */
function readable(color: RGB, bgs: RGB[], min: number): { color: RGB; ok: boolean } {
  const worst = (c: RGB) => Math.min(...bgs.map((b) => contrast(c, b)));
  if (worst(color) >= min) return { color, ok: true };
  let best: { color: RGB; score: number; k: number } | null = null;
  for (const target of [[0, 0, 0], [255, 255, 255]] as RGB[]) {
    for (let k = 0.1; k <= 1.001; k += 0.1) {
      const c = mixTo(color, target, k);
      const s = worst(c);
      if (s >= min) {
        if (!best || k < best.k || best.score < min) best = { color: c, score: s, k };
        break;
      }
      if (!best || (best.score < min && s > best.score)) best = { color: c, score: s, k: 2 };
    }
  }
  return { color: best!.color, ok: best!.score >= min };
}

/** Kontrast aller Texte und Icons prüfen und automatisch korrigieren. */
export function fixContrast(slide: HTMLElement, index: number, warn: (w: Warning) => void) {
  const layers = layersOf(slide);
  const probe = (el: Element, rect: DOMRect, width: number) => {
    const y = rect.top + Math.min(rect.height, (el as HTMLElement).scrollHeight || rect.height) / 2;
    const w = Math.max(1, Math.min(rect.width, width));
    const xs = [rect.left + w * 0.1, rect.left + w * 0.5, rect.left + w * 0.9];
    const all: RGB[] = [];
    for (const x of xs) {
      const b = backgroundsAt(layers, el, x, y);
      if (b === null) return null;
      all.push(...b);
    }
    return all;
  };
  // Texte
  for (const el of Array.from(slide.querySelectorAll<HTMLElement>('[data-fit]'))) {
    const text = (el.textContent ?? '').trim();
    if (!text) continue;
    const cs = getComputedStyle(el);
    const col = parseRgb(cs.color);
    if (!col) continue;
    const rect = el.getBoundingClientRect();
    const bgs = probe(el, rect, el.scrollWidth);
    if (!bgs) continue;
    const size = parseFloat(cs.fontSize) || 16;
    const min = size >= 24 ? 3 : 4.5;
    const res = readable([col[0], col[1], col[2]], bgs, min);
    if (res.color !== undefined && (res.color[0] !== col[0] || res.color[1] !== col[1] || res.color[2] !== col[2])) {
      el.style.color = toCss(res.color);
    }
    const final = Math.min(...bgs.map((b) => contrast(res.color, b)));
    if (!res.ok && final < 3) warn({ index, message: `Text schwer lesbar (Kontrast ${final.toFixed(1)}:1): „${short(text)}“ – andere Tonalität/Layout wählen` });
  }
  // Icons (eingefärbte SVGs)
  for (const svg of Array.from(slide.querySelectorAll<SVGSVGElement>('svg[fill]'))) {
    const fill = svg.getAttribute('fill') ?? '';
    const m = /^#([0-9a-f]{6})$/i.exec(fill);
    if (!m) continue;
    const col: RGB = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) as RGB;
    const rect = svg.getBoundingClientRect();
    const bgs = probe(svg, rect, rect.width);
    if (!bgs) continue;
    const res = readable(col, bgs, 3);
    if (res.color[0] !== col[0] || res.color[1] !== col[1] || res.color[2] !== col[2]) svg.setAttribute('fill', `#${toHex(res.color)}`);
  }
}

/** Einheitliche Titelgröße auf den Inhaltsfolien eines Builds. */
export function unifyTitles(slides: HTMLElement[], specs: SlideSpec[], warn: (w: Warning) => void) {
  const titles = slides
    .map((s, i) => ({ i, el: HERO.has(specs[i].layout) ? null : s.querySelector<HTMLElement>('[data-pptx-name="!!title"]') }))
    .filter((t): t is { i: number; el: HTMLElement } => !!t.el);
  if (titles.length < 3) return;
  const sizes = titles.map((t) => parseFloat(t.el.style.fontSize) || 0).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)];
  const target = Math.max(sizes[0], Math.round(median * 0.88));
  for (const t of titles) {
    const size = parseFloat(t.el.style.fontSize) || 0;
    if (size > target) {
      t.el.style.fontSize = `${target}px`;
      const lines = Number(t.el.dataset.lines) || 0;
      if (lines) t.el.style.maxHeight = `${Math.ceil(lines * parseFloat(t.el.style.lineHeight) * target) + 2}px`;
    } else if (size < target) {
      warn({ index: t.i, message: `Titel „${short(t.el.textContent ?? '')}“ ist deutlich länger als die übrigen und wird kleiner – kürzer formulieren (einheitliche Titelgrößen)` });
    }
  }
}

/** Titelgrößen der Inhaltsfolien (für die Deck-Prüfung) */
export function titleSizes(slides: HTMLElement[], specs: SlideSpec[]): Array<number | null> {
  return slides.map((s, i) => {
    if (HERO.has(specs[i].layout)) return null;
    const el = s.querySelector<HTMLElement>('[data-pptx-name="!!title"]');
    return el ? parseFloat(el.style.fontSize) || null : null;
  });
}

/** Einheitlichkeit über die ganze Präsentation. */
export function consistencyChecks(specs: SlideSpec[], sizes: Array<number | null>, warn: (w: Warning) => void) {
  const content = specs.map((s, i) => ({ s, i })).filter(({ s }) => !HERO.has(s.layout));
  // Überzeilen: bei allen Inhaltsfolien oder bei keiner
  const withKicker = content.filter(({ s }) => s.kicker?.trim());
  if (content.length >= 4 && withKicker.length > 0 && withKicker.length < content.length) {
    const ratio = withKicker.length / content.length;
    if (ratio > 0.25 && ratio < 0.75) warn({ index: withKicker[0].i, message: `Überzeilen (kicker) nur auf ${withKicker.length} von ${content.length} Inhaltsfolien – einheitlich bei allen oder bei keiner` });
  }
  // Satzzeichen am Titelende einheitlich
  const titled = content.filter(({ s }) => s.title?.trim());
  const withDot = titled.filter(({ s }) => /[.!]$/.test(s.title!.trim()));
  if (titled.length >= 4 && withDot.length > 0 && withDot.length < titled.length) {
    warn({ index: withDot[0].i, message: `Titel enden mal mit Punkt, mal ohne – einheitlich ohne Punkt formulieren` });
  }
  // Titellänge
  for (const { s, i } of titled) {
    if (s.title!.trim().split(/\s+/).length > 12) warn({ index: i, message: `Titel zu lang (${s.title!.trim().split(/\s+/).length} Wörter) – höchstens ~10 Wörter` });
  }
  // Titelgrößen über das Deck (nach Einzeländerungen)
  const known = sizes.filter((x): x is number => !!x).sort((a, b) => a - b);
  if (known.length >= 3) {
    const median = known[Math.floor(known.length / 2)];
    sizes.forEach((size, i) => {
      if (size && Math.abs(size - median) / median > 0.15) warn({ index: i, message: `Titelgröße weicht ab (${size}px statt ~${median}px) – Titel ${size < median ? 'kürzen' : 'prüfen'}, damit alle gleich groß sind` });
    });
  }
  // Wiederholungen
  for (let i = 1; i < specs.length; i++) {
    if (specs[i].layout === specs[i - 1].layout && !HERO.has(specs[i].layout)) {
      warn({ index: i, message: `Gleiches Layout wie die Folie davor (${specs[i].layout}) – Abwechslung wählen` });
    }
  }
  const counts = new Map<string, number>();
  for (const { s } of content) counts.set(s.layout, (counts.get(s.layout) ?? 0) + 1);
  for (const [layout, n] of counts) {
    if (content.length >= 5 && n / content.length > 0.4) warn({ index: 0, message: `Layout „${layout}“ auf ${n} von ${content.length} Inhaltsfolien – mehr Vielfalt` });
  }
  if (specs.length >= 6 && !specs.some((s) => HERO.has(s.layout) && s.layout !== 'title' && s.layout !== 'closing')) {
    warn({ index: 0, message: 'Keine Rhythmus-Brecher (statement, big_number, giant, image_hero, quote, section) – mindestens einen einbauen' });
  }
}
