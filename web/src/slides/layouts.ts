// Layout-Bibliothek (HTML/CSS). Das Modell liefert Layout + Inhalt, jedes Layout
// gestaltet daraus eine Folie im gewählten Stil. Raster: 1280 × 720 px.
import { accentInk, badge, body, card, esc, frame, header, heroInk, illustration, numberMark, photo, T, toneText, track, variant, type Ctx, type Tone } from './kit';
import { iconSvg } from './icons';
import { gradientEnd, mix, rgba, shade, tint } from './styles';

export const LAYOUTS = [
  'title', 'section', 'agenda', 'statement', 'big_number', 'quote', 'closing',
  'bullets', 'split', 'cards', 'icon_grid', 'icon_rows', 'bento', 'kpis', 'progress',
  'chart', 'table', 'comparison', 'options', 'process', 'timeline', 'cycle',
  'funnel', 'pyramid', 'matrix', 'swot', 'checklist', 'people',
  'image_hero', 'image_split', 'image_grid', 'image_cards', 'image_quote', 'image_stat',
  'stat_row', 'numbered', 'testimonials', 'roadmap', 'giant', 'faq',
] as const;
export type LayoutName = (typeof LAYOUTS)[number];

export interface SlideItem {
  icon?: string;
  title?: string;
  text?: string;
  value?: string;
  label?: string;
  date?: string;
  featured?: boolean;
  done?: boolean;
  progress?: number;
  /** Foto: ID aus search_images (z. B. "img3") oder Bild-URL */
  image?: string;
  image_credit?: string;
  image_focus?: string;
}
export interface ChartSpec {
  type?: 'column' | 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'stacked_column' | 'stacked_bar';
  categories?: string[];
  series?: Array<{ name?: string; values?: number[] }>;
  unit?: string;
  /** Kategorie, die hervorgehoben wird (übrige Balken dezent) */
  highlight?: string;
}
export interface SlideSpec {
  layout: LayoutName;
  title?: string;
  subtitle?: string;
  kicker?: string;
  text?: string;
  icon?: string;
  number?: string;
  value?: string;
  label?: string;
  items?: SlideItem[];
  bullets?: string[];
  left?: { title?: string; items?: string[] };
  right?: { title?: string; items?: string[] };
  verdict?: string;
  chart?: ChartSpec;
  takeaway?: string;
  highlight?: { value?: string; label?: string };
  quote?: string;
  author?: string;
  role?: string;
  columns?: string[];
  rows?: string[][];
  x_label?: string;
  y_label?: string;
  notes?: string;
  /** Foto: ID aus search_images (z. B. "img3") oder Bild-URL */
  image?: string;
  image_credit?: string;
  /** Bildausschnitt, z. B. "50% 30%" (Gesichter/Motiv im Bild halten) */
  image_focus?: string;
  image_side?: 'left' | 'right';
  image_scrim?: 'bottom' | 'left' | 'full' | 'none';
  /** Gestaltungsvariante (sonst wählt die Design-Signatur der Präsentation) */
  variant?: string;
  /** Übergang zu dieser Folie (Standard: keiner). Sparsam einsetzen. */
  transition?: 'morph' | 'fade' | 'none';
}

const list = (spec: SlideSpec, max: number) => (spec.items ?? []).filter((i) => i && (i.title || i.text || i.value || i.label)).slice(0, max);

/** Icons, die ein Layout braucht (zum Vorladen) */
export function iconQueries(spec: SlideSpec): string[] {
  const q = [spec.icon, ...(spec.items ?? []).map((i) => i?.icon)];
  q.push('checkmark circle', 'dismiss circle', 'arrow right', 'circle', 'lightbulb', 'star', 'quote', 'question circle', 'checkmark');
  return q.filter((x): x is string => !!x);
}

// ── Heldenfolien ───────────────────────────────────────────────────────────

function titleClassic(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  if (spec.image) return titlePhotoSlide(spec, ctx);
  const blocks = d.style.decoration === 'blocks';
  const orbs = d.style.decoration === 'orbs' || d.style.decoration === 'bubbles' || d.style.decoration === 'organic' || d.style.decoration === 'confetti';
  const ink = heroInk(d, true);
  const w = blocks ? '470px' : orbs ? '640px' : d.style.id === 'neo' && spec.icon ? '780px' : '900px';
  const color = blocks ? d.onPrimary : ink.text;
  const muted = blocks ? tint(d.primary, 0.78) : ink.muted;
  const size = d.style.id === 'swiss' ? 96 : d.style.id === 'corporate' ? 60 : d.style.id === 'keynote' ? 88 : 80;
  const kicker = spec.kicker ? T(spec.kicker, { font: d.style.label, size: 16, color: blocks ? d.onPrimary : ink.kicker, ls: 3, upper: true, nowrap: true, w, min: 11 }) : '';
  const title = T(spec.title, { font: d.style.display, size, min: 34, color, lh: 1.02, ls: track(ctx, size), lines: 3, w, name: '!!title' });
  const sub = spec.subtitle ? T(spec.subtitle, { font: d.style.light, size: 24, min: 15, color: muted, lines: 3, w }) : '';
  const icon = d.style.decoration === 'orbs' && spec.icon ? `<div style="position:absolute;left:${780 + 280 - 70}px;top:${90 + 280 - 70}px">${iconSvg(spec.icon, 140, d.onPrimary)}</div>` : '';
  const blocksIcon = blocks && spec.icon ? `<div style="position:absolute;left:${ctx.index % 2 ? 930 + 110 : 860 + 110}px;top:${ctx.index % 2 ? 330 + 110 : 250 + 110}px">${iconSvg(spec.icon, 140, onColorSafe(d.accent))}</div>` : '';
  const neoCard = d.style.id === 'neo' && spec.icon ? `<div style="position:absolute;right:110px;top:${720 / 2 - 110}px">${badge(ctx, spec.icon, 220)}</div>` : '';
  const editorialLike = d.style.id === 'swiss' || d.style.id === 'editorial' || d.style.id === 'noir' || d.style.id === 'mono';
  const justify = editorialLike ? 'space-between' : 'center';
  const rule = editorialLike ? `<div style="height:${d.style.id === 'noir' ? 1 : 2}px;background:#${d.style.id === 'noir' ? d.primary : d.text};width:100%;flex:none"></div>` : '';
  const inner = editorialLike
    ? `<div style="display:flex;flex-direction:column;gap:18px">${kicker}${title}</div><div style="display:flex;flex-direction:column;gap:18px">${rule}${sub}</div>`
    : `<div style="display:flex;flex-direction:column;gap:22px">${kicker}${title}${sub}</div>`;
  return frame(ctx, inner + icon + blocksIcon + neoCard, { hero: true, justify, pad: d.style.id === 'noir' ? '96px 110px' : '72px 80px 64px 80px', notes: spec.notes });
}

/** Titelfolie mit Foto: Bild rechts (oder links) in voller Höhe, Titel daneben. */
function titlePhotoSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const right = spec.image_side !== 'left';
  const pw = 560;
  const radius = d.style.radius >= 20 ? 28 : 0;
  const inset = radius ? 28 : 0;
  const pic = photo(spec.image, { w: `${pw - inset}px`, h: `${720 - inset * 2}px`, radius, abs: { x: right ? 1280 - pw : inset, y: inset }, focus: spec.image_focus, credit: spec.image_credit, name: '!!photo' });
  const tw = 1280 - pw - 150;
  const kicker = spec.kicker ? T(spec.kicker, { font: d.style.label, size: 16, color: accentInk(d), ls: 3, upper: true, nowrap: true, w: `${tw}px`, min: 11 }) : '';
  const title = T(spec.title, { font: d.style.display, size: 68, min: 32, color: d.text, lh: 1.03, ls: track(ctx, 68), lines: 4, w: `${tw}px`, name: '!!title' });
  const sub = spec.subtitle ? T(spec.subtitle, { font: d.style.light, size: 22, min: 14, color: d.muted, lines: 3, w: `${tw}px` }) : '';
  const txt = `<div style="position:absolute;left:${right ? 80 : pw + 70}px;top:0;width:${tw}px;height:720px;display:flex;flex-direction:column;justify-content:center;gap:22px">${kicker}${title}${sub}</div>`;
  return frame(ctx, '', { under: pic + txt, notes: spec.notes, noDeco: true, pad: '0' });
}

const onColorSafe = (hex: string) => (parseInt(hex.slice(0, 2), 16) * 0.299 + parseInt(hex.slice(2, 4), 16) * 0.587 + parseInt(hex.slice(4, 6), 16) * 0.114 > 150 ? '111418' : 'FFFFFF');

/** Heldenfolien mit großer Hintergrund-Deko (sonst nur dezente Deko) */
const bigHero = (d: Ctx['d']) => ['aurora', 'grid', 'gradient', 'mesh', 'spot', 'blueprint', 'hairline'].includes(d.style.decoration);

function sectionClassic(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  if (spec.image) return imageHeroSlide({ ...spec, kicker: spec.kicker ?? spec.number }, ctx);
  const blocks = d.style.decoration === 'blocks';
  const ink = heroInk(d, true);
  const color = blocks ? d.onPrimary : ink.text;
  const num = spec.number ? T(spec.number, { font: d.style.display, size: 170, min: 60, color: blocks ? d.accent2 : d.style.decoration === 'gradient' ? 'FFFFFF' : accentInk(d), lh: 0.9, ls: track(ctx, 170), nowrap: true, w: '520px' }) : '';
  // Bei großen Deko-Formen rechts schmaler setzen, damit nichts überlappt
  const w = blocks ? '470px' : ['orbs', 'bubbles', 'organic', 'confetti'].includes(d.style.decoration) ? '620px' : '860px';
  const title = T(spec.title, { font: d.style.display, size: 64, min: 32, color, lh: 1.05, ls: track(ctx, 64), lines: 3, w, name: '!!title' });
  const sub = spec.subtitle ? T(spec.subtitle, { font: d.style.light, size: 22, min: 14, color: blocks ? tint(d.primary, 0.78) : ink.muted, lines: 2, w }) : '';
  return frame(ctx, `<div style="display:flex;flex-direction:column;gap:18px">${num}${title}${sub}</div>`, { hero: true, justify: 'center', pad: '72px 80px', notes: spec.notes });
}

function statementClassic(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  if (spec.image) return imageHeroSlide({ ...spec, image_scrim: spec.image_scrim ?? 'full' }, ctx);
  const text = spec.title ?? spec.text;
  const hero = bigHero(d);
  const ink = heroInk(d, hero);
  const kicker = spec.kicker ? T(spec.kicker, { font: d.style.label, size: 16, color: ink.kicker, ls: 3, upper: true, nowrap: true, min: 11 }) : '';
  const big = T(text, { font: d.style.display, size: 64, min: 30, color: ink.text, lh: 1.08, ls: track(ctx, 64), lines: 5, w: spec.icon ? '860px' : '1060px', name: '!!title' });
  const sub = spec.subtitle ? T(spec.subtitle, { font: d.style.light, size: 22, min: 14, color: ink.muted, lines: 3, w: '820px' }) : '';
  const icon = spec.icon ? `<div style="position:absolute;right:88px;top:${720 / 2 - 90}px">${badge(ctx, spec.icon, 180, d.style.decoration === 'gradient' ? 'dark' : 'primary')}</div>` : '';
  // Nur dezente Deko: die großen Hero-Formen würden mit der Kernbotschaft kollidieren
  return frame(ctx, `<div style="display:flex;flex-direction:column;gap:24px">${kicker}${big}${sub}</div>${icon}`, { hero, justify: 'center', pad: '72px 88px', notes: spec.notes });
}

function bigNumberSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  if (spec.image) return imageStatSlide(spec, ctx);
  const value = spec.value ?? spec.highlight?.value ?? spec.items?.[0]?.value;
  const label = spec.label ?? spec.highlight?.label ?? spec.title;
  const numColor = d.style.id === 'swiss' ? d.primary : accentInk(d);
  const num = T(value, { font: d.style.display, size: 250, min: 90, color: numColor, lh: 0.95, ls: track(ctx, 250) * 1.5, nowrap: true, w: '640px', name: '!!bignum' });
  const right = `<div style="width:460px;display:flex;flex-direction:column;gap:18px">` +
    (spec.kicker ? T(spec.kicker, { font: d.style.label, size: 15, color: d.muted, ls: 2.5, upper: true, nowrap: true, min: 11 }) : '') +
    T(label, { font: d.style.heading, size: 40, min: 22, color: d.text, lh: 1.12, ls: track(ctx, 40), lines: 4, w: '460px' }) +
    (spec.text ? T(spec.text, { font: d.style.light, size: 20, min: 13, color: d.muted, lh: 1.45, lines: 5, w: '440px' }) : '') +
    `</div>`;
  return frame(ctx, `<div style="display:flex;align-items:center;justify-content:space-between;gap:40px;flex:1">${num}${right}</div>`, { justify: 'center', notes: spec.notes });
}

function quoteSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  if (spec.image) return imageQuoteSlide(spec, ctx);
  const serif = d.style.id === 'editorial' || d.style.id === 'noir' || d.style.id === 'organic';
  const hero = bigHero(d);
  const ink = heroInk(d, hero);
  const mark = T('“', { font: 'Georgia', size: 200, min: 60, color: ink.kicker, lh: 0.8, nowrap: true, w: '140px' });
  const q = T(spec.quote ?? spec.text, { font: serif ? 'Georgia' : d.style.light, size: 42, min: 22, color: ink.text, lh: 1.25, italic: serif, lines: 6, w: '1000px' });
  const who = `<div style="display:flex;flex-direction:column;gap:4px">${T(spec.author, { font: d.style.heading, size: 22, min: 14, color: ink.kicker, nowrap: true, w: '800px' })}${T(spec.role, { font: d.style.light, size: 18, min: 12, color: ink.muted, nowrap: true, w: '800px' })}</div>`;
  return frame(ctx, `<div style="display:flex;flex-direction:column;gap:26px">${mark}${q}${who}</div>`, { hero, justify: 'center', pad: '64px 110px', notes: spec.notes });
}

function closingClassic(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 4);
  if (spec.image && !items.length) return imageHeroSlide({ ...spec, title: spec.title ?? 'Vielen Dank' }, ctx);
  // Mit Schritte-Liste keine großen Farbflächen (die Karten lägen darüber)
  const blocks = d.style.decoration === 'blocks' && !items.length;
  const hero = !items.length || bigHero(d);
  const ink = heroInk(d, hero);
  const color = blocks ? d.onPrimary : ink.text;
  const left = `<div style="width:${items.length ? (blocks ? 440 : 520) : blocks ? 470 : ['orbs', 'bubbles', 'organic', 'confetti'].includes(d.style.decoration) ? 640 : 1000}px;display:flex;flex-direction:column;gap:20px;flex:none">` +
    T(spec.title ?? 'Vielen Dank', { font: d.style.display, size: 72, min: 34, color, lh: 1.03, ls: track(ctx, 72), lines: 3, w: '100%', name: '!!title' }) +
    (spec.subtitle ? T(spec.subtitle, { font: d.style.light, size: 22, min: 14, color: blocks ? tint(d.primary, 0.78) : ink.muted, lines: 3, w: '100%' }) : '') +
    `</div>`;
  const onGradient = hero && d.style.decoration === 'gradient';
  const tone: Tone = onGradient ? 'dark' : 'default';
  const right = items.length
    ? `<div style="flex:1;display:flex;flex-direction:column;gap:14px;${blocks ? 'margin-left:60px' : ''}">` +
      items.map((it) => card(ctx, `<div style="display:flex;gap:18px;align-items:center">${badge(ctx, it.icon || 'arrow right', 48, tone)}<div style="flex:1;display:flex;flex-direction:column;gap:4px;min-width:0">${T(it.title, { font: d.style.heading, size: 21, min: 14, color: toneText(ctx, tone).text, nowrap: true, group: 'cl-t' })}${T(it.text, { font: d.style.light, size: 16, min: 12, color: toneText(ctx, tone).muted, lines: 2, group: 'cl-b' })}</div></div>`, { pad: 20, tone })).join('') +
      `</div>`
    : '';
  return frame(ctx, `<div style="display:flex;align-items:center;gap:60px;flex:1">${left}${right}</div>`, { hero, justify: 'center', pad: '64px 80px', notes: spec.notes });
}

// ── Text & Karten ──────────────────────────────────────────────────────────

function agendaClassic(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 8);
  const cols = items.length > 4 ? 2 : 1;
  const rows = Math.ceil(items.length / cols);
  const grid = `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${rows},auto);grid-auto-flow:column;column-gap:56px;row-gap:${rows > 3 ? 30 : 40}px">` +
    items.map((it, i) => `<div style="display:flex;gap:28px;align-items:center;min-height:0">${numberMark(ctx, i + 1, 64, i === 0 ? 'highlight' : 'default')}<div style="flex:1;display:flex;flex-direction:column;gap:6px;min-width:0">${T(it.title ?? it.text, { font: d.style.heading, size: 32, min: 18, color: d.text, lines: 1, nowrap: true, group: 'ag-t' })}${it.title && it.text ? T(it.text, { font: d.style.light, size: 21, min: 13, color: d.muted, lines: 2, group: 'ag-b' }) : ''}</div></div>`).join('') +
    `</div>`;
  return frame(ctx, header(ctx, spec) + body(grid, 'justify-content:center'), { notes: spec.notes });
}

function bulletsClassic(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const bullets = (spec.bullets?.length ? spec.bullets : list(spec, 6).map((i) => [i.title, i.text].filter(Boolean).join(' – '))).slice(0, 6);
  const dot = accentInk(d);
  const rows = bullets.map((b) => `<div style="display:flex;gap:20px;align-items:flex-start;min-height:0"><div style="width:12px;height:12px;margin-top:13px;border-radius:${d.style.radius ? 6 : 0}px;background:#${dot};flex:none"></div>${T(b, { font: d.style.body, size: 26, min: 16, color: d.text, lh: 1.35, lines: 2, grow: true, group: 'bl' })}</div>`).join('');
  const left = `<div style="flex:1;display:flex;flex-direction:column;gap:20px;justify-content:center;min-width:0">${rows}</div>`;
  const sideInner = spec.highlight?.value
    ? T(spec.highlight.value, { font: d.style.display, size: 84, min: 36, color: toneText(ctx, 'primary').text, nowrap: true, ls: track(ctx, 84), w: '100%' }) + T(spec.highlight.label, { font: d.style.light, size: 20, min: 13, color: toneText(ctx, 'primary').muted, lines: 4, w: '100%' })
    : badge(ctx, spec.icon || 'lightbulb', 120, 'primary');
  const side = card(ctx, sideInner, { tone: 'primary', pad: 40, extra: 'width:360px;flex:none;justify-content:center', gap: 16 });
  return frame(ctx, header(ctx, spec, { w: '760px' }) + body(`<div style="display:flex;gap:56px;flex:1;min-height:0">${left}${side}</div>`), { notes: spec.notes });
}

function splitSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 5);
  const panel = `<div data-block="1" style="position:absolute;left:0;top:0;width:500px;height:720px;background:linear-gradient(160deg,#${d.primary} 0%,#${d.style.dark ? gradientEnd(d) : shade(d.primary, 0.35)} 100%)"></div>`;
  const pt = toneText(ctx, 'primary');
  const leftTxt = `<div style="position:absolute;left:72px;top:0;width:360px;height:720px;display:flex;flex-direction:column;justify-content:center;gap:22px">` +
    (spec.kicker ? T(spec.kicker, { font: d.style.label, size: 15, color: pt.muted, ls: 2.5, upper: true, nowrap: true, min: 11 }) : '') +
    T(spec.title, { font: d.style.display, size: 50, min: 26, color: pt.text, lh: 1.06, ls: track(ctx, 50), lines: 5, w: '360px', name: '!!title' }) +
    (spec.text || spec.subtitle ? T(spec.text ?? spec.subtitle, { font: d.style.light, size: 20, min: 13, color: pt.muted, lh: 1.4, lines: 6, w: '360px' }) : '') +
    `</div>`;
  const rowsHtml = items.length
    ? items.map((it) => `<div style="display:flex;gap:22px;align-items:flex-start;min-height:0">${badge(ctx, it.icon || 'checkmark', 52)}<div style="flex:1;display:flex;flex-direction:column;gap:6px;min-width:0">${T(it.title, { font: d.style.heading, size: 24, min: 15, color: d.text, lines: 1, nowrap: true, group: 'sp-t' })}${T(it.text, { font: d.style.light, size: 18, min: 12, color: d.muted, lh: 1.4, lines: 2, group: 'sp-b' })}</div></div>`).join('')
    : (spec.bullets ?? []).map((b) => T(b, { font: d.style.body, size: 24, min: 15, color: d.text, lines: 2, group: 'sp-b' })).join('');
  const right = `<div style="position:absolute;left:580px;top:0;width:630px;height:720px;display:flex;flex-direction:column;justify-content:center;gap:30px">${rowsHtml}</div>`;
  return frame(ctx, panel + leftTxt + right, { notes: spec.notes, pad: '0' });
}

function cardsClassic(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 6);
  const n = Math.max(items.length, 1);
  const cols = n <= 4 ? n : 3;
  // Karten so hoch wie ihr Inhalt (mindestens 250 px), als Gruppe im Inhaltsbereich zentriert
  const grid = `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);grid-auto-rows:minmax(${n > 4 ? 200 : 250}px,auto);gap:22px;min-height:0">` +
    items.map((it, i) => {
      const tone: Tone = d.style.id === 'bento' && i === 0 ? 'primary' : 'default';
      const tt = toneText(ctx, tone);
      return card(ctx, badge(ctx, it.icon || 'star', 60, tone) + `<div style="height:10px;flex:none"></div>` + T(it.title, { font: d.style.heading, size: cols >= 4 ? 26 : 29, min: 16, color: tt.text, lines: 2, group: 'cd-t' }) + T(it.text, { font: d.style.light, size: cols >= 4 ? 20 : 22, min: 13, color: tt.muted, lh: 1.4, lines: 5, group: 'cd-b' }), { tone, gap: 12, pad: 34 });
    }).join('') +
    `</div>`;
  return frame(ctx, header(ctx, spec) + body(grid, 'justify-content:center'), { notes: spec.notes });
}

function iconGridClassic(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 8);
  const n = Math.max(items.length, 1);
  const cols = n <= 3 ? n : n === 4 ? 4 : n <= 6 ? 3 : 4;
  const grid = `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);grid-auto-rows:auto;column-gap:52px;row-gap:48px;min-height:0">` +
    items.map((it) => `<div style="display:flex;flex-direction:column;gap:14px;min-height:0">${iconSvg(it.icon || 'star', 52, accentInk(d))}${T(it.title, { font: d.style.heading, size: 27, min: 15, color: d.text, lines: 2, group: 'ig-t' })}${T(it.text, { font: d.style.light, size: 20, min: 13, color: d.muted, lh: 1.4, lines: 3, group: 'ig-b' })}</div>`).join('') +
    `</div>`;
  return frame(ctx, header(ctx, spec) + body(grid, 'justify-content:center'), { notes: spec.notes });
}

function iconRowsSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 5);
  const line = d.style.dark ? 'rgba(255,255,255,0.12)' : rgba(d.text, 0.1);
  const rows = items.map((it, i) => `<div style="display:flex;gap:32px;align-items:center;min-height:0;${i ? `border-top:1px solid ${line};` : ''}padding-top:${i ? 26 : 0}px">${badge(ctx, it.icon || 'checkmark', 68)}<div style="width:360px;flex:none">${T(it.title, { font: d.style.heading, size: 29, min: 16, color: d.text, lines: 2, group: 'ir-t' })}</div>${T(it.text, { font: d.style.light, size: 22, min: 13, color: d.muted, lh: 1.4, lines: 2, grow: true, group: 'ir-b' })}</div>`).join('');
  return frame(ctx, header(ctx, spec) + body(`<div style="display:flex;flex-direction:column;gap:26px">${rows}</div>`, 'justify-content:center'), { notes: spec.notes });
}

function bentoSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 5);
  const n = items.length;
  // Kachel-Anordnungen je Anzahl: [spalte, zeile, spaltenbreite, zeilenhöhe]
  const areas: Record<number, string[]> = {
    2: ['1 / 1 / 3 / 2', '1 / 2 / 3 / 4'],
    3: ['1 / 1 / 3 / 2', '1 / 2 / 2 / 4', '2 / 2 / 3 / 4'],
    4: ['1 / 1 / 3 / 2', '1 / 2 / 2 / 3', '1 / 3 / 2 / 4', '2 / 2 / 3 / 4'],
    5: ['1 / 1 / 3 / 2', '1 / 2 / 2 / 3', '1 / 3 / 2 / 4', '2 / 2 / 3 / 3', '2 / 3 / 3 / 4'],
  };
  const tones: Tone[] = ['primary', 'default', d.style.dark ? 'soft' : 'dark', 'soft', 'default'];
  const tiles = items.map((it, i) => {
    const tone = tones[i];
    const tt = toneText(ctx, tone);
    const big = i === 0;
    const inner =
      (it.icon && !it.value ? badge(ctx, it.icon, big ? 64 : 48, tone) : '') +
      (it.value ? T(it.value, { font: d.style.display, size: big ? 110 : 60, min: 30, color: tt.text, lh: 0.95, ls: track(ctx, big ? 110 : 60), nowrap: true, w: '100%' }) : '') +
      T(it.title ?? it.label, { font: d.style.heading, size: big ? 30 : 23, min: 14, color: tt.text, lines: 2, w: '100%' }) +
      T(it.text, { font: d.style.light, size: big ? 19 : 16, min: 12, color: tt.muted, lh: 1.4, grow: true, w: '100%' });
    return `<div style="grid-area:${areas[n]?.[i] ?? 'auto'};min-height:0;min-width:0;display:flex">${card(ctx, inner, { tone, gap: 10, pad: big ? 36 : 28, extra: 'flex:1;justify-content:' + (big ? 'flex-end' : 'flex-start') })}</div>`;
  }).join('');
  const grid = `<div style="flex:1;display:grid;grid-template-columns:1.25fr 1fr 1fr;grid-template-rows:1fr 1fr;gap:20px;min-height:0">${tiles}</div>`;
  return frame(ctx, header(ctx, spec) + body(grid), { gap: 26, notes: spec.notes });
}

// ── Zahlen & Daten ─────────────────────────────────────────────────────────

function kpisClassic(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 4);
  const cards = items.map((it, i) => {
    const tone: Tone = i === 0 && d.style.id !== 'swiss' ? 'primary' : 'default';
    const tt = toneText(ctx, tone);
    const numCol = tone === 'default' ? (d.style.id === 'swiss' ? d.text : accentInk(d)) : tt.text;
    return card(ctx,
      (it.icon ? badge(ctx, it.icon, 44, tone) : '') +
      `<div style="flex:1"></div>` +
      T(it.value, { font: d.style.display, size: 76, min: 30, color: numCol, lh: 1, ls: track(ctx, 76), nowrap: true, group: 'kp-v' }) +
      T(it.label ?? it.title, { font: d.style.heading, size: 25, min: 15, color: tt.text, lines: 2, group: 'kp-l' }) +
      T(it.text, { font: d.style.light, size: 19, min: 13, color: tt.muted, lh: 1.35, lines: 3, group: 'kp-b' }),
      { tone, gap: 8, pad: 32 });
  }).join('');
  const take = spec.takeaway
    ? `<div style="display:flex;gap:16px;align-items:center;flex:none">${iconSvg('lightbulb', 30, d.accent, 'filled')}${T(spec.takeaway, { font: d.style.light, size: 21, min: 14, color: d.text, italic: true, lines: 2, grow: true })}</div>`
    : '';
  const grid = `<div style="display:grid;grid-template-columns:repeat(${Math.max(items.length, 1)},1fr);gap:22px;height:340px;flex:none">${cards}</div>`;
  return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:30px">${grid}${take}</div>`), { notes: spec.notes });
}

function progressSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 6);
  const track2 = d.style.dark ? 'rgba(255,255,255,0.1)' : rgba(d.text, 0.08);
  const fill = accentInk(d);
  if (items.length <= 3 && items.length > 0) {
    // Ringe (SVG, bleibt als Vektorgrafik erhalten)
    const ring = (p: number) => {
      const r = 80;
      const c = 2 * Math.PI * r;
      const v = Math.max(0, Math.min(100, p));
      return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200" style="display:block;flex:none"><circle cx="100" cy="100" r="${r}" fill="none" stroke="${d.style.dark ? '#2A2D45' : '#' + tint(d.primary, 0.85)}" stroke-width="18"/><circle cx="100" cy="100" r="${r}" fill="none" stroke="#${fill}" stroke-width="18" stroke-linecap="round" stroke-dasharray="${(c * v) / 100} ${c}" transform="rotate(-90 100 100)"/></svg>`;
    };
    const cols = items.map((it) => `<div style="display:flex;flex-direction:column;align-items:center;gap:16px;min-width:0"><div style="position:relative;width:200px;height:200px">${ring(it.progress ?? parseFloat(String(it.value ?? '0')))}<div style="position:absolute;left:0;top:0;width:200px;height:200px;display:flex;align-items:center;justify-content:center">${T(it.value ?? `${it.progress ?? 0} %`, { font: d.style.display, size: 42, min: 20, color: d.text, nowrap: true, align: 'center', w: '160px', group: 'pr-v' })}</div></div>${T(it.title ?? it.label, { font: d.style.heading, size: 22, min: 14, color: d.text, align: 'center', lines: 2, w: '100%', group: 'pr-t' })}${T(it.text, { font: d.style.light, size: 17, min: 12, color: d.muted, align: 'center', lines: 3, w: '100%', group: 'pr-b' })}</div>`).join('');
    return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:grid;grid-template-columns:repeat(${items.length},1fr);gap:40px;align-items:center">${cols}</div>`), { notes: spec.notes });
  }
  const rows = items.map((it) => {
    const p = Math.max(0, Math.min(100, it.progress ?? parseFloat(String(it.value ?? '0')) ?? 0));
    return `<div style="display:flex;flex-direction:column;gap:10px;min-height:0"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:20px">${T(it.title ?? it.label, { font: d.style.heading, size: 27, min: 15, color: d.text, nowrap: true, grow: true, group: 'pb-t' })}${T(it.value ?? `${p} %`, { font: d.style.display, size: 32, min: 18, color: fill, nowrap: true, align: 'right', w: '180px', group: 'pb-v' })}</div><div style="height:18px;border-radius:9px;background:${track2};flex:none;position:relative"><div style="position:absolute;left:0;top:0;height:18px;width:${p}%;border-radius:9px;background:linear-gradient(90deg,#${fill} 0%,#${d.style.dark ? d.accent2 : shade(fill, 0.2)} 100%)"></div></div></div>`;
  }).join('');
  return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:34px;max-width:1040px">${rows}</div>`), { notes: spec.notes });
}

function chartSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const side = spec.takeaway || spec.highlight?.value;
  const payload = encodeURIComponent(JSON.stringify(spec.chart ?? {}));
  const chart = `<div data-chart="${payload}" style="flex:1;min-width:0;min-height:0"></div>`;
  const sideCard = side
    ? card(ctx,
      (spec.highlight?.value ? T(spec.highlight.value, { font: d.style.display, size: 64, min: 28, color: toneText(ctx, 'primary').text, nowrap: true, ls: track(ctx, 64), w: '100%' }) + T(spec.highlight.label, { font: d.style.light, size: 18, min: 12, color: toneText(ctx, 'primary').muted, lines: 3, w: '100%' }) + `<div style="height:14px;flex:none"></div>` : '') +
      T(spec.takeaway, { font: d.style.body, size: 20, min: 13, color: toneText(ctx, 'primary').text, lh: 1.4, grow: true, w: '100%' }),
      { tone: 'primary', pad: 32, extra: 'width:330px;flex:none', gap: 8 })
    : '';
  return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:flex;gap:40px;min-height:0">${chart}${sideCard}</div>`), { notes: spec.notes });
}

function tableSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const cols = (spec.columns ?? []).slice(0, 7);
  const rows = (spec.rows ?? []).slice(0, 9).map((r) => cols.map((_, i) => String(r?.[i] ?? '')));
  const headBg = d.style.dark ? mix(d.bg, d.primary, 0.45) : d.primary;
  const headFg = d.style.dark ? 'FFFFFF' : d.onPrimary;
  const zebra = d.style.dark ? mix(d.bg, 'FFFFFF', 0.05) : d.style.id === 'bento' ? 'FFFFFF' : tint(d.primary, 0.95);
  const fs = rows.length > 6 ? 18 : 22;
  const cell = (c: string, bold: boolean, bg: string, color: string) => `<td style="padding:${rows.length > 6 ? 12 : 18}px 20px;background:#${bg};color:#${color};font-family:'${bold ? d.style.heading : d.style.body}';font-size:${fs}px;border-bottom:1px solid ${d.style.dark ? 'rgba(255,255,255,0.08)' : rgba(d.text, 0.08)}">${esc(c)}</td>`;
  const html = `<table style="width:100%;border-collapse:collapse;border-radius:${Math.min(d.style.radius, 16)}px;overflow:hidden">` +
    `<tr>${cols.map((c) => `<td style="padding:14px 16px;background:#${headBg};color:#${headFg};font-family:'${d.style.heading}';font-size:${fs}px">${esc(c)}</td>`).join('')}</tr>` +
    rows.map((r, ri) => `<tr>${r.map((c, ci) => cell(c, ci === 0, ri % 2 ? zebra : d.style.dark ? d.bg : d.style.id === 'bento' ? 'F7F7F5' : 'FFFFFF', d.text)).join('')}</tr>`).join('') +
    `</table>`;
  return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:flex;flex-direction:column;justify-content:center">${html}</div>`), { notes: spec.notes });
}

// ── Struktur & Vergleiche ──────────────────────────────────────────────────

function comparisonSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const side = (data: SlideSpec['left'], tone: Tone, icon: string, iconCol: string) => {
    const tt = toneText(ctx, tone);
    const rows = (data?.items ?? []).slice(0, 6).map((x) => `<div style="display:flex;gap:14px;align-items:flex-start;min-height:0">${iconSvg(icon, 30, iconCol, 'filled')}${T(x, { font: d.style.body, size: 23, min: 14, color: tt.text, lh: 1.35, lines: 2, grow: true, group: 'cmp' })}</div>`).join('');
    return card(ctx, T(data?.title, { font: d.style.heading, size: 32, min: 18, color: tt.text, nowrap: true, w: '100%' }) + `<div style="height:10px;flex:none"></div>` + rows, { tone, gap: 16, pad: 36, extra: 'flex:1' });
  };
  const left = side(spec.left, d.style.id === 'bento' ? 'default' : 'default', 'dismiss circle', d.faint);
  const right = side(spec.right, 'primary', 'checkmark circle', d.style.dark ? 'FFFFFF' : onColorSafe(d.primary) === 'FFFFFF' ? tint(d.accent, 0.3) : d.accent);
  const verdict = spec.verdict ? T(spec.verdict, { font: d.style.heading, size: 23, min: 14, color: accentInk(d), lines: 2, w: '100%' }) : '';
  return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:flex;gap:24px;min-height:0">${left}${right}</div>${verdict ? `<div style="height:20px;flex:none"></div>${verdict}` : ''}`), { notes: spec.notes });
}

function optionsSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 4);
  const featured = Math.max(0, items.findIndex((i) => i.featured));
  const cards = items.map((it, i) => {
    const tone: Tone = i === featured ? 'primary' : 'default';
    const tt = toneText(ctx, tone);
    const tag = i === featured ? `<div style="align-self:flex-start;padding:6px 14px;border-radius:999px;background:${tone === 'primary' ? 'rgba(255,255,255,0.22)' : '#' + d.primary};flex:none">${T(it.label ?? 'Empfohlen', { font: d.style.label, size: 14, color: tt.text, nowrap: true, upper: true, ls: 1.5, min: 10 })}</div>` : `<div style="height:31px;flex:none"></div>`;
    const bullets = (it.text ?? '').split(/;|\n/).map((s) => s.trim()).filter(Boolean).slice(0, 5);
    return card(ctx,
      tag + T(it.title, { font: d.style.heading, size: 26, min: 15, color: tt.text, lines: 2, group: 'op-t' }) +
      T(it.value, { font: d.style.display, size: 54, min: 24, color: tone === 'primary' ? tt.text : accentInk(d), nowrap: true, ls: track(ctx, 54), group: 'op-v' }) +
      `<div style="height:1px;background:${tone === 'primary' ? 'rgba(255,255,255,0.3)' : rgba(d.text, 0.1)};flex:none"></div>` +
      bullets.map((b) => `<div style="display:flex;gap:10px;align-items:flex-start">${iconSvg('checkmark', 22, tone === 'primary' ? tt.text : d.primary)}${T(b, { font: d.style.light, size: 17, min: 12, color: tt.muted, lines: 2, grow: true, group: 'op-b' })}</div>`).join(''),
      { tone, gap: 12, pad: 30, extra: i === featured ? 'margin-top:-14px;margin-bottom:-14px' : '' });
  }).join('');
  return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:grid;grid-template-columns:repeat(${Math.max(items.length, 1)},1fr);gap:22px;align-items:stretch;min-height:0;padding:14px 0">${cards}</div>`), { notes: spec.notes });
}

function processClassic(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 5);
  const n = Math.max(items.length, 1);
  const lineCol = d.style.dark ? 'rgba(255,255,255,0.18)' : rgba(d.primary, 0.25);
  const steps = items.map((it, i) => `<div style="display:flex;flex-direction:column;gap:14px;min-width:0;position:relative">` +
    `<div style="display:flex;align-items:center;gap:14px">${numberMark(ctx, i + 1, 58, i === n - 1 ? 'highlight' : 'default')}${i < n - 1 ? `<div style="flex:1;height:2px;background:${lineCol}"></div>` : ''}</div>` +
    (it.icon ? iconSvg(it.icon, 36, accentInk(d)) : '') +
    T(it.title, { font: d.style.heading, size: 28, min: 15, color: d.text, lines: 2, group: 'ps-t' }) +
    T(it.text, { font: d.style.light, size: 21, min: 13, color: d.muted, lh: 1.4, lines: 5, group: 'ps-b' }) +
    `</div>`).join('');
  return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:grid;grid-template-columns:repeat(${n},1fr);gap:26px;align-content:center">${steps}</div>`), { notes: spec.notes });
}

function timelineClassic(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 6);
  const n = Math.max(items.length, 1);
  const lineCol = d.style.dark ? 'rgba(255,255,255,0.2)' : rgba(d.primary, 0.3);
  const cols = items.map((it, i) => `<div style="display:flex;flex-direction:column;gap:14px;align-items:flex-start;min-width:0">` +
    T(it.date ?? it.label, { font: d.style.display, size: 36, min: 18, color: accentInk(d), nowrap: true, ls: track(ctx, 36), group: 'tl-d' }) +
    `<div style="width:100%;height:22px;position:relative;flex:none"><div style="position:absolute;left:0;top:10px;width:${i < n - 1 ? 'calc(100% + 26px)' : '100%'};height:2px;background:${lineCol}"></div><div style="position:absolute;left:0;top:0;width:22px;height:22px;border-radius:50%;background:#${i === n - 1 ? d.accent : d.primary};box-shadow:0 0 0 6px ${d.style.dark ? rgba(d.primary, 0.25) : rgba(d.primary, 0.15)}"></div></div>` +
    T(it.title, { font: d.style.heading, size: 27, min: 15, color: d.text, lines: 2, group: 'tl-t' }) +
    T(it.text, { font: d.style.light, size: 20, min: 13, color: d.muted, lh: 1.4, lines: 4, group: 'tl-b' }) +
    `</div>`).join('');
  return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:grid;grid-template-columns:repeat(${n},1fr);gap:26px;align-content:center">${cols}</div>`), { notes: spec.notes });
}

function cycleSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 6);
  const n = Math.max(items.length, 3);
  const cx = 360;
  const cy = 290;
  const R = 210;
  const ring = `<div style="position:absolute;left:${cx - R}px;top:${cy - R}px;width:${2 * R}px;height:${2 * R}px;border-radius:50%;border:2px dashed ${d.style.dark ? 'rgba(255,255,255,0.22)' : rgba(d.primary, 0.3)}"></div>`;
  const center = `<div data-block="1" style="position:absolute;left:${cx - 110}px;top:${cy - 110}px;width:220px;height:220px;border-radius:110px;background:linear-gradient(135deg,#${d.primary} 0%,#${d.style.dark ? gradientEnd(d) : shade(d.primary, 0.3)} 100%);display:flex;align-items:center;justify-content:center;padding:26px;box-sizing:border-box">${T(spec.text ?? spec.label ?? '', { font: d.style.heading, size: 26, min: 14, color: d.onPrimary, align: 'center', lines: 4, w: '168px' })}</div>`;
  const nodes = items.map((_it, i) => {
    const a = (-Math.PI / 2) + (2 * Math.PI * i) / n;
    const x = cx + R * Math.cos(a);
    const y = cy + R * Math.sin(a);
    return `<div style="position:absolute;left:${x - 34}px;top:${y - 34}px">${numberMark(ctx, i + 1, 68, 'default')}</div>`;
  }).join('');
  const legend = `<div style="position:absolute;left:700px;top:0;width:436px;height:580px;display:flex;flex-direction:column;justify-content:center;gap:18px">` +
    items.map((it, i) => `<div style="display:flex;gap:16px;align-items:flex-start">${T(String(i + 1).padStart(2, '0'), { font: d.style.display, size: 22, min: 14, color: accentInk(d), nowrap: true, w: '40px' })}<div style="flex:1;display:flex;flex-direction:column;gap:3px;min-width:0">${T(it.title, { font: d.style.heading, size: 21, min: 13, color: d.text, nowrap: true, group: 'cy-t' })}${T(it.text, { font: d.style.light, size: 16, min: 11, color: d.muted, lines: 2, group: 'cy-b' })}</div></div>`).join('') +
    `</div>`;
  return frame(ctx, header(ctx, spec) + body(`<div style="position:relative;flex:1">${ring}${nodes}${center}${legend}</div>`), { notes: spec.notes });
}

function funnelSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 5);
  const n = Math.max(items.length, 1);
  const rows = items.map((it, i) => {
    const w = 100 - (i * 44) / Math.max(n - 1, 1);
    const col = n === 1 ? d.primary : mix(d.primary, d.style.dark ? d.accent : tint(d.primary, 0.55), i / (n - 1));
    const fg = onColorSafe(col);
    return `<div style="display:flex;align-items:center;gap:36px;flex:1;min-height:0"><div style="width:560px;flex:none;display:flex;justify-content:center"><div data-block="1" style="width:${w}%;height:100%;min-height:54px;border-radius:${Math.min(d.style.radius, 14)}px;background:#${col};display:flex;align-items:center;justify-content:center;gap:16px;padding:0 20px;box-sizing:border-box">${T(it.value, { font: d.style.display, size: 30, min: 16, color: fg, nowrap: true, group: 'fn-v' })}${T(it.label, { font: d.style.body, size: 17, min: 11, color: fg, nowrap: true, group: 'fn-l' })}</div></div><div style="flex:1;display:flex;flex-direction:column;gap:4px;min-width:0">${T(it.title, { font: d.style.heading, size: 22, min: 14, color: d.text, nowrap: true, group: 'fn-t' })}${T(it.text, { font: d.style.light, size: 16, min: 11, color: d.muted, lines: 2, group: 'fn-b' })}</div></div>`;
  }).join('');
  return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:flex;flex-direction:column;gap:12px;min-height:0">${rows}</div>`), { notes: spec.notes });
}

function pyramidSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 5);
  const n = Math.max(items.length, 1);
  // Spitze oben: erster Eintrag = oberste (schmalste) Stufe
  const rows = items.map((it, i) => {
    const w = 34 + (66 * (i + 1)) / n;
    const col = mix(d.primary, d.style.dark ? d.accent : tint(d.primary, 0.6), i / Math.max(n - 1, 1));
    const fg = onColorSafe(col);
    return `<div style="display:flex;align-items:center;gap:40px;flex:1;min-height:0"><div style="width:520px;flex:none;display:flex;justify-content:center;height:100%"><div data-block="1" style="width:${w}%;height:100%;background:#${col};border-radius:${i === 0 ? '999px 999px 8px 8px' : '8px'};display:flex;align-items:center;justify-content:center">${T(it.label ?? it.value ?? String(i + 1), { font: d.style.heading, size: 20, min: 12, color: fg, nowrap: true, align: 'center', w: '90%', group: 'py-l' })}</div></div><div style="flex:1;display:flex;flex-direction:column;gap:4px;min-width:0">${T(it.title, { font: d.style.heading, size: 22, min: 14, color: d.text, nowrap: true, group: 'py-t' })}${T(it.text, { font: d.style.light, size: 16, min: 11, color: d.muted, lines: 2, group: 'py-b' })}</div></div>`;
  }).join('');
  return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:flex;flex-direction:column;gap:10px;min-height:0">${rows}</div>`), { notes: spec.notes });
}

function matrixSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 4);
  const hi = Math.max(0, items.findIndex((i) => i.featured));
  const cells = [0, 1, 2, 3].map((i) => {
    const it = items[i] ?? {};
    const tone: Tone = i === hi ? 'primary' : 'default';
    const tt = toneText(ctx, tone);
    return card(ctx, (it.icon ? badge(ctx, it.icon, 42, tone) : '') + T(it.title, { font: d.style.heading, size: 24, min: 14, color: tt.text, lines: 2, group: 'mx-t' }) + T(it.text, { font: d.style.light, size: 17, min: 11, color: tt.muted, lh: 1.35, grow: true, group: 'mx-b' }), { tone, gap: 8, pad: 26 });
  }).join('');
  const ax = d.style.dark ? d.muted : d.muted;
  // Achsen als waagerechte Beschriftungen (gedrehter Text übersteht die Umwandlung nicht sauber)
  const yLab = spec.y_label ? T('↑ ' + spec.y_label, { font: d.style.label, size: 15, color: ax, nowrap: true, upper: true, ls: 1.5, min: 10, w: '100%' }) : '';
  const xLab = spec.x_label ? T(spec.x_label + ' →', { font: d.style.label, size: 15, color: ax, nowrap: true, upper: true, ls: 1.5, align: 'right', w: '100%', min: 10 }) : '';
  return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:flex;flex-direction:column;gap:10px;min-height:0">${yLab}<div style="position:relative;flex:1;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:16px;min-height:0">${cells}</div>${xLab}</div>`), { notes: spec.notes });
}

function swotSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 4);
  const letters = ['S', 'W', 'O', 'T'];
  const names = ['Stärken', 'Schwächen', 'Chancen', 'Risiken'];
  const tones: Tone[] = ['primary', 'default', 'soft', 'default'];
  const cells = letters.map((L, i) => {
    const it = items[i] ?? {};
    const tt = toneText(ctx, tones[i]);
    const points = (it.text ?? '').split(/;|\n/).map((s) => s.trim()).filter(Boolean).slice(0, 4);
    return card(ctx,
      `<div style="display:flex;align-items:baseline;gap:14px">${T(L, { font: d.style.display, size: 54, min: 30, color: tones[i] === 'primary' ? tt.text : accentInk(d), nowrap: true, w: '48px', lh: 1 })}${T(it.title ?? names[i], { font: d.style.heading, size: 24, min: 14, color: tt.text, nowrap: true, grow: true })}</div>` +
      points.map((p) => T('•  ' + p, { font: d.style.light, size: 17, min: 11, color: tt.muted, lines: 2, group: 'sw-b' })).join(''),
      { tone: tones[i], gap: 6, pad: 26 });
  }).join('');
  return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:16px;min-height:0">${cells}</div>`), { notes: spec.notes });
}

function checklistSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 8);
  const cols = items.length > 4 ? 2 : 1;
  const rows = items.map((it) => {
    const done = it.done !== false;
    const ic = done ? iconSvg('checkmark circle', 40, accentInk(d), 'filled') : iconSvg('circle', 40, d.faint, 'regular');
    return `<div style="display:flex;gap:18px;align-items:flex-start;min-height:0">${ic}<div style="flex:1;display:flex;flex-direction:column;gap:4px;min-width:0">${T(it.title ?? it.text, { font: d.style.heading, size: 28, min: 15, color: done ? d.text : d.muted, lines: 2, group: 'ck-t' })}${it.title && it.text ? T(it.text, { font: d.style.light, size: 20, min: 12, color: d.muted, lines: 2, group: 'ck-b' }) : ''}</div></div>`;
  }).join('');
  return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:grid;grid-template-columns:repeat(${cols},1fr);column-gap:60px;row-gap:26px;align-content:center">${rows}</div>`), { notes: spec.notes });
}

function peopleSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 8);
  const n = Math.max(items.length, 1);
  const cols = n <= 4 ? n : 4;
  const colors = [d.primary, d.accent, d.accent2, shade(d.primary, 0.3)];
  const cards = items.map((it, i) => {
    const initials = String(it.title ?? '?').split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    const col = colors[i % colors.length];
    const avatar = it.image ? photo(it.image, { w: '96px', h: '96px', radius: d.style.id === 'blocks' || d.style.id === 'swiss' ? 0 : 48, focus: it.image_focus ?? '50% 30%' }) : `<div style="width:96px;height:96px;border-radius:${d.style.id === 'blocks' || d.style.id === 'swiss' ? 0 : 48}px;background:#${col};display:flex;align-items:center;justify-content:center;flex:none">${T(initials, { font: d.style.display, size: 34, color: onColorSafe(col), nowrap: true, align: 'center', w: '96px', min: 16 })}</div>`;
    return card(ctx, avatar + `<div style="height:6px;flex:none"></div>` + T(it.title, { font: d.style.heading, size: 26, min: 15, color: d.text, nowrap: true, group: 'pp-t' }) + T(it.label, { font: d.style.label, size: 16, min: 11, color: accentInk(d), nowrap: true, group: 'pp-l' }) + T(it.text, { font: d.style.light, size: 19, min: 12, color: d.muted, lh: 1.4, lines: 3, group: 'pp-b' }), { gap: 6, pad: 28 });
  }).join('');
  return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:grid;grid-template-columns:repeat(${cols},1fr);grid-auto-rows:auto;gap:20px;min-height:0;align-content:center">${cards}</div>`), { notes: spec.notes });
}

// ── Fotos ──────────────────────────────────────────────────────────────────

/** Vollflächiges Foto mit Abdunklung, Titel unten links (Kapitel, Einstieg, Stimmung). */
function imageHeroSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const scrim = spec.image_scrim ?? (ctx.index % 2 ? 'left' : 'bottom');
  const pic = photo(spec.image, { w: '1280px', h: '720px', abs: { x: 0, y: 0 }, scrim, focus: spec.image_focus, credit: spec.image_credit, name: '!!photo' });
  const w = scrim === 'left' ? '720px' : '1000px';
  const kicker = spec.kicker ? T(spec.kicker, { font: d.style.label, size: 16, color: 'FFFFFF', ls: 3, upper: true, nowrap: true, min: 11, w }) : '';
  const title = T(spec.title ?? spec.text, { font: d.style.display, size: 72, min: 32, color: 'FFFFFF', lh: 1.03, ls: track(ctx, 72), lines: 3, w, name: '!!title' });
  const sub = spec.subtitle ? T(spec.subtitle, { font: d.style.light, size: 23, min: 14, color: 'E8E8E8', lines: 3, w }) : '';
  const accentBar = `<div style="width:84px;height:6px;border-radius:${d.style.radius ? 3 : 0}px;background:#${d.style.dark ? d.accent : d.primary === '111111' ? d.accent : d.primary};flex:none"></div>`;
  return frame(ctx, `<div style="display:flex;flex-direction:column;gap:20px">${accentBar}${kicker}${title}${sub}</div>`, {
    under: pic, noDeco: true, justify: scrim === 'left' ? 'center' : 'flex-end', pad: scrim === 'left' ? '72px 80px' : '72px 80px 70px 80px', notes: spec.notes,
  });
}

/** Foto auf einer Hälfte, Inhalt auf der anderen. */
function imageSplitSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const left = spec.image_side ? spec.image_side === 'left' : ctx.index % 2 === 0;
  const pw = 560;
  const gap = d.style.radius >= 20 ? 24 : 0;
  const r = gap ? Math.min(d.style.radius + 4, 32) : 0;
  const pic = photo(spec.image, { w: `${pw - gap}px`, h: `${720 - gap * 2}px`, radius: r, abs: { x: left ? gap : 1280 - pw, y: gap }, focus: spec.image_focus, credit: spec.image_credit, name: '!!photo' });
  const cw = 1280 - pw - 150;
  const x = left ? pw + 70 : 80;
  const items = list(spec, 4);
  const rows = items.length
    ? items.map((it) => `<div style="display:flex;gap:18px;align-items:flex-start;min-height:0">${badge(ctx, it.icon || 'checkmark', 46)}<div style="flex:1;display:flex;flex-direction:column;gap:4px;min-width:0">${T(it.title, { font: d.style.heading, size: 22, min: 14, color: d.text, nowrap: true, group: 'is-t' })}${T(it.text, { font: d.style.light, size: 17, min: 12, color: d.muted, lh: 1.4, lines: 2, group: 'is-b' })}</div></div>`).join('')
    : (spec.bullets ?? []).slice(0, 5).map((b) => `<div style="display:flex;gap:16px;align-items:flex-start"><div style="width:10px;height:10px;margin-top:11px;border-radius:5px;background:#${accentInk(d)};flex:none"></div>${T(b, { font: d.style.body, size: 21, min: 14, color: d.text, lh: 1.35, lines: 2, grow: true, group: 'is-bl' })}</div>`).join('');
  const txt = `<div style="position:absolute;left:${x}px;top:0;width:${cw}px;height:720px;display:flex;flex-direction:column;justify-content:center;gap:20px">` +
    (spec.kicker ? T(spec.kicker, { font: d.style.label, size: 15, color: accentInk(d), ls: 2.5, upper: d.style.kickerUpper, nowrap: true, min: 11, w: '100%' }) : '') +
    T(spec.title, { font: d.style.display, size: 46, min: 24, color: d.text, lh: 1.08, ls: track(ctx, 46), lines: 3, w: '100%', name: '!!title' }) +
    (spec.text ? T(spec.text, { font: d.style.light, size: 20, min: 13, color: d.muted, lh: 1.45, lines: items.length || spec.bullets?.length ? 3 : 7, w: '100%' }) : '') +
    (rows ? `<div style="display:flex;flex-direction:column;gap:18px;margin-top:8px">${rows}</div>` : '') +
    `</div>`;
  return frame(ctx, '', { under: pic + txt, notes: spec.notes, pad: '0', noDeco: true, bg: d.bg });
}

/** Galerie: 2–4 Fotos mit Beschriftung im Bild. */
function imageGridSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = (spec.items ?? []).filter((i) => i && (i.image || i.title)).slice(0, 4);
  const n = Math.max(items.length, 1);
  const r = Math.min(d.style.radius, 24);
  const areas: Record<number, string[]> = {
    1: ['1 / 1 / 3 / 4'],
    2: ['1 / 1 / 3 / 2', '1 / 2 / 3 / 4'],
    3: ['1 / 1 / 3 / 2', '1 / 2 / 2 / 4', '2 / 2 / 3 / 4'],
    4: ['1 / 1 / 3 / 2', '1 / 2 / 2 / 3', '1 / 3 / 2 / 4', '2 / 2 / 3 / 4'],
  };
  const tiles = items.map((it, i) => {
    const big = i === 0;
    const cap = `<div style="position:absolute;left:0;bottom:0;width:100%;box-sizing:border-box;padding:${big ? 28 : 20}px;display:flex;flex-direction:column;gap:4px">` +
      T(it.title, { font: d.style.heading, size: big ? 28 : 21, min: 13, color: 'FFFFFF', lines: 2, w: '100%', group: big ? undefined : 'ig-t' }) +
      T(it.text, { font: d.style.light, size: big ? 17 : 15, min: 11, color: 'E6E6E6', lines: 2, w: '100%', group: big ? undefined : 'ig-b' }) +
      `</div>`;
    const pic = photo(it.image, { w: '100%', h: '100%', radius: r, scrim: it.title || it.text ? 'bottom' : 'none', credit: it.image_credit, focus: it.image_focus });
    return `<div style="grid-area:${areas[n]?.[i] ?? 'auto'};position:relative;min-height:0;min-width:0;display:flex">${pic.replace('flex:none;', 'flex:1;')}${cap}</div>`;
  }).join('');
  const grid = `<div style="flex:1;display:grid;grid-template-columns:${n >= 3 ? '1.3fr 1fr 1fr' : '1fr 1fr 1fr'};grid-template-rows:1fr 1fr;gap:16px;min-height:0">${tiles}</div>`;
  return frame(ctx, header(ctx, spec) + body(grid), { gap: 24, notes: spec.notes });
}

/** Karten mit Foto oben. */
function imageCardsSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = (spec.items ?? []).filter((i) => i && (i.image || i.title)).slice(0, 4);
  const n = Math.max(items.length, 1);
  const r = d.style.radius;
  const cards = items.map((it) => {
    const inner = photo(it.image, { w: '100%', h: n >= 4 ? '170px' : '210px', radius: d.style.card === 'plain' ? 0 : Math.max(0, r - 10), credit: it.image_credit, focus: it.image_focus }) +
      `<div style="display:flex;flex-direction:column;gap:8px;padding:${d.style.card === 'plain' ? '0' : '6px 8px 4px 8px'};min-height:0">` +
      T(it.title, { font: d.style.heading, size: n >= 4 ? 22 : 25, min: 14, color: d.text, lines: 2, group: 'ic-t' }) +
      T(it.text, { font: d.style.light, size: n >= 4 ? 16 : 18, min: 12, color: d.muted, lh: 1.4, lines: 4, group: 'ic-b' }) +
      `</div>`;
    return card(ctx, inner, { pad: d.style.card === 'plain' ? 0 : 12, gap: 14 });
  }).join('');
  return frame(ctx, header(ctx, spec) + body(`<div style="display:grid;grid-template-columns:repeat(${n},1fr);gap:22px;min-height:0">${cards}</div>`, 'justify-content:center'), { notes: spec.notes });
}

/** Zitat neben einem Foto. */
function imageQuoteSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const pw = 520;
  const pic = photo(spec.image, { w: `${pw}px`, h: '720px', abs: { x: 0, y: 0 }, focus: spec.image_focus, credit: spec.image_credit, name: '!!photo' });
  const serif = d.style.id === 'editorial' || d.style.id === 'noir' || d.style.id === 'organic';
  const cw = 1280 - pw - 170;
  const txt = `<div style="position:absolute;left:${pw + 90}px;top:0;width:${cw}px;height:720px;display:flex;flex-direction:column;justify-content:center;gap:24px">` +
    T('“', { font: 'Georgia', size: 160, min: 60, color: accentInk(d), lh: 0.75, nowrap: true, w: '120px' }) +
    T(spec.quote ?? spec.text, { font: serif ? 'Georgia' : d.style.light, size: 36, min: 20, color: d.text, lh: 1.28, italic: serif, lines: 7, w: '100%' }) +
    `<div style="display:flex;flex-direction:column;gap:4px">${T(spec.author, { font: d.style.heading, size: 21, min: 14, color: accentInk(d), nowrap: true, w: '100%' })}${T(spec.role, { font: d.style.light, size: 17, min: 12, color: d.muted, nowrap: true, w: '100%' })}</div>` +
    `</div>`;
  return frame(ctx, '', { under: pic + txt, notes: spec.notes, pad: '0', noDeco: true });
}

/** Große Zahl auf einem Foto. */
function imageStatSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const value = spec.value ?? spec.highlight?.value ?? spec.items?.[0]?.value;
  const label = spec.label ?? spec.highlight?.label ?? spec.title;
  const pic = photo(spec.image, { w: '1280px', h: '720px', abs: { x: 0, y: 0 }, scrim: 'left', focus: spec.image_focus, credit: spec.image_credit, name: '!!photo' });
  const inner = `<div style="width:760px;display:flex;flex-direction:column;gap:16px">` +
    (spec.kicker ? T(spec.kicker, { font: d.style.label, size: 15, color: 'FFFFFF', ls: 2.5, upper: true, nowrap: true, min: 11 }) : '') +
    T(value, { font: d.style.display, size: 200, min: 80, color: 'FFFFFF', lh: 0.95, ls: track(ctx, 200) * 1.5, nowrap: true, w: '760px', name: '!!bignum' }) +
    T(label, { font: d.style.heading, size: 36, min: 20, color: 'FFFFFF', lh: 1.12, lines: 3, w: '640px' }) +
    (spec.text ? T(spec.text, { font: d.style.light, size: 19, min: 13, color: 'E6E6E6', lh: 1.45, lines: 4, w: '600px' }) : '') +
    `</div>`;
  return frame(ctx, inner, { under: pic, noDeco: true, justify: 'center', pad: '72px 88px', notes: spec.notes });
}

// ── Weitere Inhaltslayouts ─────────────────────────────────────────────────

/** 2–4 große Zahlen nebeneinander, getrennt durch feine Linien – ohne Karten. */
function statRowSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 4);
  const n = Math.max(items.length, 1);
  const line = d.style.dark ? 'rgba(255,255,255,0.16)' : rgba(d.text, 0.14);
  const size = n <= 2 ? 150 : n === 3 ? 118 : 92;
  const cols = items.map((it, i) => `<div style="display:flex;flex-direction:column;gap:12px;min-width:0;padding:0 ${i < n - 1 ? 36 : 0}px 0 ${i ? 36 : 0}px;${i ? `border-left:1px solid ${line};` : ''}">` +
    T(it.value, { font: d.style.display, size, min: 40, color: i === 0 ? accentInk(d) : d.text, lh: 1, ls: track(ctx, size) * 1.3, nowrap: true, w: '100%', group: 'sr-v' }) +
    T(it.label ?? it.title, { font: d.style.heading, size: 24, min: 14, color: d.text, lines: 2, w: '100%', group: 'sr-l' }) +
    T(it.text, { font: d.style.light, size: 18, min: 12, color: d.muted, lh: 1.4, lines: 3, w: '100%', group: 'sr-b' }) +
    `</div>`).join('');
  const take = spec.takeaway ? T(spec.takeaway, { font: d.style.light, size: 21, min: 14, color: d.muted, italic: true, lines: 2, w: '100%' }) : '';
  return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:40px"><div style="display:grid;grid-template-columns:repeat(${n},1fr)">${cols}</div>${take}</div>`), { notes: spec.notes });
}

/** Nummerierte Liste im Magazin-Stil: große Ziffern, Linien. */
function numberedSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 6);
  const cols = items.length > 4 ? 2 : 1;
  const big = cols === 1;
  const line = d.style.dark ? 'rgba(255,255,255,0.16)' : rgba(d.text, 0.16);
  const rows = items.map((it, i) => `<div style="display:flex;gap:26px;align-items:flex-start;border-top:${d.style.card === 'brutal' ? '2.5px solid #111418' : `1px solid ${line}`};padding-top:20px;min-height:0">` +
    T(String(i + 1).padStart(2, '0'), { font: d.style.display, size: big ? 60 : 54, min: 26, color: accentInk(d), lh: 0.9, nowrap: true, ls: track(ctx, 54), w: big ? '110px' : '86px' }) +
    (big
      ? `<div style="flex:1;display:flex;gap:40px;align-items:baseline;min-width:0"><div style="width:380px;flex:none">${T(it.title, { font: d.style.heading, size: 30, min: 16, color: d.text, lines: 2, group: 'nb-t' })}</div>${T(it.text, { font: d.style.light, size: 21, min: 13, color: d.muted, lh: 1.4, lines: 2, grow: true, group: 'nb-b' })}</div>`
      : `<div style="flex:1;display:flex;flex-direction:column;gap:6px;min-width:0">${T(it.title, { font: d.style.heading, size: 26, min: 15, color: d.text, lines: 2, group: 'nb-t' })}${T(it.text, { font: d.style.light, size: 18, min: 12, color: d.muted, lh: 1.4, lines: 3, group: 'nb-b' })}</div>`) +
    `</div>`).join('');
  return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:grid;grid-template-columns:repeat(${cols},1fr);column-gap:56px;row-gap:26px;align-content:center">${rows}</div>`), { notes: spec.notes });
}

/** 2–3 Stimmen/Zitate als Karten. */
function testimonialsSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 3);
  const n = Math.max(items.length, 1);
  const cards = items.map((it, i) => {
    const tone: Tone = i === 0 && n > 1 && d.style.card !== 'plain' ? 'primary' : 'default';
    const tt = toneText(ctx, tone);
    const initials = String(it.title ?? '?').split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    const avatar = it.image
      ? photo(it.image, { w: '52px', h: '52px', radius: 26 })
      : `<div style="width:52px;height:52px;border-radius:26px;background:${tone === 'primary' ? 'rgba(255,255,255,0.22)' : '#' + tint(d.primary, 0.8)};display:flex;align-items:center;justify-content:center;flex:none">${T(initials, { font: d.style.heading, size: 19, color: tone === 'primary' ? tt.text : shade(d.primary, 0.3), nowrap: true, align: 'center', w: '52px', min: 12 })}</div>`;
    return card(ctx,
      T('“', { font: 'Georgia', size: 90, min: 40, color: tone === 'primary' ? tt.text : accentInk(d), lh: 0.7, nowrap: true, w: '60px' }) +
      T(it.text, { font: d.style.light, size: n === 3 ? 21 : 24, min: 13, color: tt.text, lh: 1.4, grow: true, group: 'ts-q' }) +
      `<div style="display:flex;gap:14px;align-items:center;flex:none">${avatar}<div style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0">${T(it.title, { font: d.style.heading, size: 18, min: 12, color: tt.text, nowrap: true, group: 'ts-n' })}${T(it.label, { font: d.style.light, size: 15, min: 11, color: tt.muted, nowrap: true, group: 'ts-r' })}</div></div>`,
      { tone, gap: 14, pad: 34 });
  }).join('');
  return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:grid;grid-template-columns:repeat(${n},1fr);gap:22px;min-height:0">${cards}</div>`), { notes: spec.notes });
}

/** Roadmap: Phasen als farbige Balken auf einer Achse. */
function roadmapSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 5);
  const n = Math.max(items.length, 1);
  const r = Math.min(d.style.radius, 14);
  const cols = items.map((it, i) => {
    const col = n === 1 ? d.primary : mix(d.primary, d.style.dark ? d.accent : d.accent, i / (n - 1));
    const fg = onColorSafe(col);
    const brutal = d.style.card === 'brutal' ? 'border:2.5px solid #111418;box-shadow:5px 5px 0 #111418;' : '';
    return `<div style="display:flex;flex-direction:column;gap:16px;min-width:0">` +
      T(it.date ?? it.label, { font: d.style.label, size: 17, min: 12, color: d.muted, nowrap: true, upper: true, ls: 1.5, w: '100%', group: 'rm-d' }) +
      `<div data-block="1" style="height:74px;border-radius:${r}px;background:#${col};display:flex;align-items:center;gap:12px;padding:0 20px;box-sizing:border-box;${brutal}">${it.icon ? iconSvg(it.icon, 28, fg, 'filled') : ''}${T(it.title, { font: d.style.heading, size: 21, min: 13, color: fg, nowrap: true, grow: true, group: 'rm-t' })}</div>` +
      T(it.text, { font: d.style.light, size: 18, min: 12, color: d.muted, lh: 1.4, lines: 5, w: '100%', group: 'rm-b' }) +
      `</div>`;
  }).join('');
  const axis = `<div style="height:2px;background:${d.style.dark ? 'rgba(255,255,255,0.2)' : rgba(d.text, 0.15)};margin:0 0 6px 0;flex:none"></div>`;
  return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:18px">${axis}<div style="display:grid;grid-template-columns:repeat(${n},1fr);gap:14px">${cols}</div></div>`), { notes: spec.notes });
}

/** Riesiges Wort oder Zahl als typografisches Bild (z. B. „2030“, „KI“, „Warum?“). */
function giantSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const hero = bigHero(d);
  const ink = heroInk(d, hero);
  const word = spec.value ?? spec.title ?? '';
  const size = word.length <= 4 ? 320 : word.length <= 7 ? 230 : 160;
  const big = T(word, { font: d.style.display, size, min: 90, color: d.style.decoration === 'gradient' ? 'FFFFFF' : accentInk(d), lh: 0.9, ls: track(ctx, size) * 1.6, nowrap: true, align: 'left', w: '1120px', name: '!!bignum' });
  const cap = `<div style="display:flex;gap:40px;align-items:flex-start">` +
    T(spec.value ? spec.title : spec.label, { font: d.style.heading, size: 34, min: 18, color: ink.text, lh: 1.15, lines: 3, w: '520px' }) +
    T(spec.text ?? spec.subtitle, { font: d.style.light, size: 20, min: 13, color: ink.muted, lh: 1.45, lines: 4, w: '520px' }) +
    `</div>`;
  return frame(ctx, `<div style="display:flex;flex-direction:column;gap:26px">${big}${cap}</div>`, { hero, justify: 'center', pad: '64px 80px', notes: spec.notes });
}

/** Fragen & Antworten in zwei Spalten. */
function faqSlide(spec: SlideSpec, ctx: Ctx) {
  const d = ctx.d;
  const items = list(spec, 6);
  const cols = items.length > 3 ? 2 : 1;
  const rows = items.map((it) => `<div style="display:flex;gap:22px;align-items:flex-start;min-height:0">${badge(ctx, it.icon || 'question circle', 54)}<div style="flex:1;display:flex;flex-direction:column;gap:8px;min-width:0">${T(it.title, { font: d.style.heading, size: 28, min: 15, color: d.text, lines: 2, group: 'fq-t' })}${T(it.text, { font: d.style.light, size: 21, min: 13, color: d.muted, lh: 1.4, lines: 3, group: 'fq-b' })}</div></div>`).join('');
  return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:grid;grid-template-columns:repeat(${cols},1fr);column-gap:64px;row-gap:48px;align-content:center">${rows}</div>`), { notes: spec.notes });
}

// ── Varianten ──────────────────────────────────────────────────────────────
// Je Layout mehrere Gestaltungen; die Design-Signatur der Präsentation wählt eine
// (einheitlich im Deck), das Feld „variant“ einer Folie überschreibt sie.

export const VARIANTS: Partial<Record<LayoutName, readonly string[]>> = {
  title: ['classic', 'band', 'illustrated', 'underline'],
  section: ['number', 'band', 'illustrated'],
  statement: ['plain', 'block', 'illustrated'],
  closing: ['plain', 'illustrated'],
  bullets: ['side', 'illustrated', 'numbered'],
  cards: ['grid', 'accent', 'stacked'],
  kpis: ['cards', 'hero', 'lines'],
  agenda: ['list', 'split', 'cards'],
  process: ['steps', 'cards', 'vertical'],
  icon_grid: ['plain', 'centered'],
  timeline: ['horizontal', 'vertical'],
};

function titleSlide(spec: SlideSpec, ctx: Ctx) {
  if (spec.image) return titlePhotoSlide(spec, ctx);
  const v = variant(ctx, spec, 'title', VARIANTS.title!);
  const d = ctx.d;
  if (v === 'classic') return titleClassic(spec, ctx);
  const kicker = (w: string, color = accentInk(d)) => (spec.kicker ? T(spec.kicker, { font: d.style.label, size: 16, color, ls: 3, upper: true, nowrap: true, w, min: 11 }) : '');
  if (v === 'band') {
    // Farbband unten mit Untertitel, Titel darüber
    const bandH = 250;
    const bandBg = d.style.badge === 'gradient' || d.style.dark ? `linear-gradient(120deg,#${d.primary} 0%,#${gradientEnd(d)} 100%)` : `#${d.primary}`;
    const brutal = d.style.card === 'brutal' ? 'border-top:3px solid #111418;' : '';
    const band = `<div data-block="1" data-pptx-name="!!band" style="position:absolute;left:0;top:${720 - bandH}px;width:1280px;height:${bandH}px;background:${bandBg};${brutal}"></div>`;
    const on = onColorSafe(d.primary);
    const icon = spec.icon ? `<div style="position:absolute;right:88px;top:${720 - bandH + (bandH - 120) / 2}px">${iconSvg(spec.icon, 120, on, 'regular')}</div>` : '';
    const top = `<div style="position:absolute;left:80px;top:0;width:1080px;height:${720 - bandH}px;display:flex;flex-direction:column;justify-content:flex-end;gap:18px;padding-bottom:40px;box-sizing:border-box">` +
      kicker('900px') + T(spec.title, { font: d.style.display, size: 76, min: 34, color: d.text, lh: 1.02, ls: track(ctx, 76), lines: 2, w: '1080px', name: '!!title' }) + `</div>`;
    const sub = spec.subtitle ? `<div style="position:absolute;left:80px;top:${720 - bandH}px;width:${spec.icon ? 860 : 1080}px;height:${bandH}px;display:flex;align-items:center">${T(spec.subtitle, { font: d.style.light, size: 26, min: 15, color: on, lines: 3, w: '100%' })}</div>` : '';
    return frame(ctx, '', { under: band + top + sub + icon, pad: '0', notes: spec.notes, noDeco: true });
  }
  if (v === 'illustrated') {
    const art = illustration(ctx, spec.icon || 'sparkle', 470, { x: 750, y: 125, seed: 1 });
    const inner = `<div style="display:flex;flex-direction:column;gap:22px;width:600px">${kicker('600px')}${T(spec.title, { font: d.style.display, size: 70, min: 32, color: d.text, lh: 1.03, ls: track(ctx, 70), lines: 4, w: '600px', name: '!!title' })}${spec.subtitle ? T(spec.subtitle, { font: d.style.light, size: 23, min: 14, color: d.muted, lines: 3, w: '580px' }) : ''}</div>`;
    return frame(ctx, inner + art, { justify: 'center', pad: '72px 80px', notes: spec.notes });
  }
  // underline: riesiger Titel, dicker Akzentbalken
  const bar = `<div style="width:140px;height:12px;background:#${d.style.dark ? d.accent : d.primary};border-radius:${d.style.radius ? 6 : 0}px;flex:none"></div>`;
  const inner = `<div style="display:flex;flex-direction:column;gap:26px">${kicker('1000px')}${T(spec.title, { font: d.style.display, size: 92, min: 36, color: d.text, lh: 1, ls: track(ctx, 92), lines: 3, w: '1100px', name: '!!title' })}${bar}${spec.subtitle ? T(spec.subtitle, { font: d.style.light, size: 24, min: 14, color: d.muted, lines: 2, w: '900px' }) : ''}</div>`;
  return frame(ctx, inner, { justify: 'center', pad: '72px 88px', notes: spec.notes });
}

function sectionSlide(spec: SlideSpec, ctx: Ctx) {
  if (spec.image) return imageHeroSlide({ ...spec, kicker: spec.kicker ?? spec.number }, ctx);
  const v = variant(ctx, spec, 'section', VARIANTS.section!);
  const d = ctx.d;
  if (v === 'number') return sectionClassic(spec, ctx);
  if (v === 'band') {
    // Linke Farbfläche mit riesiger Kapitelnummer, Titel rechts
    const on = onColorSafe(d.primary);
    const panelBg = d.style.badge === 'gradient' ? `linear-gradient(160deg,#${d.primary} 0%,#${gradientEnd(d)} 100%)` : `#${d.primary}`;
    const brutal = d.style.card === 'brutal' ? 'border-right:3px solid #111418;' : '';
    const panel = `<div data-block="1" data-pptx-name="!!band" style="position:absolute;left:0;top:0;width:430px;height:720px;background:${panelBg};${brutal}display:flex;align-items:center;justify-content:center">${T(spec.number ?? '', { font: d.style.display, size: 220, min: 80, color: on, lh: 0.9, ls: track(ctx, 220), nowrap: true, align: 'center', w: '400px' })}</div>`;
    const txt = `<div style="position:absolute;left:510px;top:0;width:690px;height:720px;display:flex;flex-direction:column;justify-content:center;gap:20px">${spec.kicker ? T(spec.kicker, { font: d.style.label, size: 16, color: accentInk(d), ls: 3, upper: true, nowrap: true, min: 11, w: '100%' }) : ''}${T(spec.title, { font: d.style.display, size: 62, min: 30, color: d.text, lh: 1.05, ls: track(ctx, 62), lines: 4, w: '100%', name: '!!title' })}${spec.subtitle ? T(spec.subtitle, { font: d.style.light, size: 22, min: 14, color: d.muted, lines: 3, w: '100%' }) : ''}</div>`;
    return frame(ctx, '', { under: panel + txt, pad: '0', notes: spec.notes, noDeco: true });
  }
  const art = illustration(ctx, spec.icon || 'bookmark', 420, { x: 790, y: 150, seed: 2 });
  const num = spec.number ? T(spec.number, { font: d.style.display, size: 110, min: 50, color: accentInk(d), lh: 0.9, ls: track(ctx, 110), nowrap: true, w: '300px' }) : '';
  const inner = `<div style="display:flex;flex-direction:column;gap:18px;width:640px">${num}${T(spec.title, { font: d.style.display, size: 62, min: 30, color: d.text, lh: 1.05, ls: track(ctx, 62), lines: 3, w: '640px', name: '!!title' })}${spec.subtitle ? T(spec.subtitle, { font: d.style.light, size: 22, min: 14, color: d.muted, lines: 2, w: '620px' }) : ''}</div>`;
  return frame(ctx, inner + art, { justify: 'center', pad: '72px 80px', notes: spec.notes });
}

function statementSlide(spec: SlideSpec, ctx: Ctx) {
  if (spec.image) return imageHeroSlide({ ...spec, image_scrim: spec.image_scrim ?? 'full' }, ctx);
  const v = variant(ctx, spec, 'statement', VARIANTS.statement!);
  const d = ctx.d;
  if (v === 'plain') return statementClassic(spec, ctx);
  const text = spec.title ?? spec.text;
  if (v === 'block') {
    // Kernbotschaft in einer großen Farbfläche
    const tt = toneText(ctx, 'primary');
    const inner = (spec.kicker ? T(spec.kicker, { font: d.style.label, size: 16, color: tt.muted, ls: 3, upper: true, nowrap: true, min: 11, w: '100%' }) : '') +
      T(text, { font: d.style.display, size: 58, min: 28, color: tt.text, lh: 1.1, ls: track(ctx, 58), lines: 5, w: '100%', name: '!!title' }) +
      (spec.subtitle ? T(spec.subtitle, { font: d.style.light, size: 22, min: 14, color: tt.muted, lines: 3, w: '100%' }) : '');
    return frame(ctx, card(ctx, inner, { tone: 'primary', pad: 64, gap: 22, extra: 'width:100%;justify-content:center;min-height:430px' }), { justify: 'center', pad: '72px 88px', notes: spec.notes });
  }
  const art = illustration(ctx, spec.icon || 'lightbulb', 400, { x: 820, y: 160, seed: 3 });
  const inner = `<div style="display:flex;flex-direction:column;gap:22px;width:700px">${spec.kicker ? T(spec.kicker, { font: d.style.label, size: 16, color: accentInk(d), ls: 3, upper: true, nowrap: true, min: 11, w: '100%' }) : ''}${T(text, { font: d.style.display, size: 56, min: 28, color: d.text, lh: 1.1, ls: track(ctx, 56), lines: 5, w: '700px', name: '!!title' })}${spec.subtitle ? T(spec.subtitle, { font: d.style.light, size: 22, min: 14, color: d.muted, lines: 3, w: '680px' }) : ''}</div>`;
  return frame(ctx, inner + art, { justify: 'center', pad: '72px 88px', notes: spec.notes });
}

function closingSlide(spec: SlideSpec, ctx: Ctx) {
  const items = list(spec, 4);
  if (spec.image && !items.length) return imageHeroSlide({ ...spec, title: spec.title ?? 'Vielen Dank' }, ctx);
  const v = variant(ctx, spec, 'closing', VARIANTS.closing!);
  if (v === 'plain' || items.length) return closingClassic(spec, ctx);
  const d = ctx.d;
  const art = illustration(ctx, spec.icon || 'heart', 430, { x: 780, y: 145, seed: 4 });
  const inner = `<div style="display:flex;flex-direction:column;gap:22px;width:640px">${T(spec.title ?? 'Vielen Dank', { font: d.style.display, size: 76, min: 34, color: d.text, lh: 1.03, ls: track(ctx, 76), lines: 3, w: '640px', name: '!!title' })}${spec.subtitle ? T(spec.subtitle, { font: d.style.light, size: 23, min: 14, color: d.muted, lines: 3, w: '600px' }) : ''}</div>`;
  return frame(ctx, inner + art, { justify: 'center', pad: '64px 80px', notes: spec.notes });
}

function bulletsSlide(spec: SlideSpec, ctx: Ctx) {
  const v = variant(ctx, spec, 'bullets', VARIANTS.bullets!);
  if (v === 'side' || (v === 'illustrated' && spec.highlight?.value)) return bulletsClassic(spec, ctx);
  const d = ctx.d;
  const bullets = (spec.bullets?.length ? spec.bullets : list(spec, 6).map((i) => [i.title, i.text].filter(Boolean).join(' – '))).slice(0, 6);
  if (v === 'illustrated') {
    const dot = accentInk(d);
    const rows = bullets.map((b) => `<div style="display:flex;gap:20px;align-items:flex-start;min-height:0"><div style="width:12px;height:12px;margin-top:13px;border-radius:${d.style.radius ? 6 : 0}px;background:#${dot};flex:none"></div>${T(b, { font: d.style.body, size: 26, min: 16, color: d.text, lh: 1.35, lines: 2, grow: true, group: 'bl' })}</div>`).join('');
    const left = `<div style="width:700px;display:flex;flex-direction:column;gap:20px;justify-content:center;min-width:0">${rows}</div>`;
    return frame(ctx, header(ctx, spec, { w: '760px' }) + body(`<div style="display:flex;gap:40px;flex:1;min-height:0;align-items:center">${left}${illustration(ctx, spec.icon || 'lightbulb', 360, { seed: 5 })}</div>`), { notes: spec.notes });
  }
  // numbered: nummerierte Zeilen über die volle Breite
  const cols = bullets.length > 3 ? 2 : 1;
  const rows = bullets.map((b, i) => `<div style="display:flex;gap:22px;align-items:center;min-height:0">${numberMark(ctx, i + 1, 54)}${T(b, { font: d.style.body, size: 25, min: 15, color: d.text, lh: 1.35, lines: 3, grow: true, group: 'bn' })}</div>`).join('');
  return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:grid;grid-template-columns:repeat(${cols},1fr);column-gap:56px;row-gap:34px;align-content:center">${rows}</div>`), { notes: spec.notes });
}

function cardsSlide(spec: SlideSpec, ctx: Ctx) {
  const v = variant(ctx, spec, 'cards', VARIANTS.cards!);
  if (v === 'grid') return cardsClassic(spec, ctx);
  const d = ctx.d;
  const items = list(spec, 6);
  const n = Math.max(items.length, 1);
  if (v === 'accent') {
    // Karten mit Farbkante oben und großer Ordnungszahl
    const cols = n <= 4 ? n : 3;
    const colors = [d.primary, d.accent, d.accent2];
    const grid = `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);grid-auto-rows:minmax(${n > 4 ? 200 : 260}px,auto);gap:22px;min-height:0">` +
      items.map((it, i) => {
        const col = colors[i % colors.length];
        const edge = `<div style="position:absolute;left:0;top:0;width:100%;height:8px;background:#${col}"></div>`;
        const headRow = `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">${T(String(i + 1).padStart(2, '0'), { font: d.style.display, size: 40, min: 20, color: d.style.dark ? tint(col, 0.2) : col, nowrap: true, lh: 1, w: '90px' })}${it.icon ? iconSvg(it.icon, 34, d.style.dark ? tint(col, 0.2) : col) : ''}</div>`;
        return card(ctx, edge + headRow + `<div style="height:6px;flex:none"></div>` + T(it.title, { font: d.style.heading, size: cols >= 4 ? 25 : 28, min: 15, color: d.text, lines: 2, group: 'ca-t' }) + T(it.text, { font: d.style.light, size: cols >= 4 ? 19 : 21, min: 13, color: d.muted, lh: 1.4, lines: 5, group: 'ca-b' }), { gap: 10, pad: 32, extra: 'position:relative' });
      }).join('') + `</div>`;
    return frame(ctx, header(ctx, spec) + body(grid, 'justify-content:center'), { notes: spec.notes });
  }
  // stacked: Karten als breite Zeilen
  const cols = n > 4 ? 2 : 1;
  const rows = items.map((it, i) => {
    const tone: Tone = i === 0 && d.style.card !== 'plain' ? 'soft' : 'default';
    const tt = toneText(ctx, tone);
    return card(ctx, `<div style="display:flex;gap:26px;align-items:center">${badge(ctx, it.icon || 'star', 56, tone)}<div style="width:${cols === 1 ? 300 : 200}px;flex:none">${T(it.title, { font: d.style.heading, size: 25, min: 15, color: tt.text, lines: 2, group: 'cs-t' })}</div>${T(it.text, { font: d.style.light, size: 20, min: 13, color: tt.muted, lh: 1.4, lines: 2, grow: true, group: 'cs-b' })}</div>`, { tone, pad: 24, gap: 0 });
  }).join('');
  return frame(ctx, header(ctx, spec) + body(`<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:16px;min-height:0">${rows}</div>`, 'justify-content:center'), { notes: spec.notes });
}

function kpisSlide(spec: SlideSpec, ctx: Ctx) {
  const v = variant(ctx, spec, 'kpis', VARIANTS.kpis!);
  const d = ctx.d;
  const items = list(spec, 4);
  if (v === 'cards' || items.length < 2) return kpisClassic(spec, ctx);
  const take = spec.takeaway
    ? `<div style="display:flex;gap:16px;align-items:center;flex:none">${iconSvg('lightbulb', 30, d.accent, 'filled')}${T(spec.takeaway, { font: d.style.light, size: 21, min: 14, color: d.text, italic: true, lines: 2, grow: true })}</div>`
    : '';
  if (v === 'hero') {
    // Wichtigste Kennzahl groß links, die übrigen gestapelt rechts
    const [first, ...rest] = items;
    const tt = toneText(ctx, 'primary');
    const big = card(ctx,
      (first.icon ? badge(ctx, first.icon, 52, 'primary') : '') + `<div style="flex:1"></div>` +
      T(first.value, { font: d.style.display, size: 120, min: 44, color: tt.text, lh: 1, ls: track(ctx, 120), nowrap: true, w: '100%' }) +
      T(first.label ?? first.title, { font: d.style.heading, size: 28, min: 16, color: tt.text, lines: 2, w: '100%' }) +
      T(first.text, { font: d.style.light, size: 20, min: 13, color: tt.muted, lh: 1.35, lines: 3, w: '100%' }),
      { tone: 'primary', pad: 40, gap: 8, extra: 'flex:1.25' });
    const side = `<div style="flex:1;display:flex;flex-direction:column;gap:18px;min-width:0">` + rest.map((it) => card(ctx,
      `<div style="display:flex;gap:20px;align-items:center">${T(it.value, { font: d.style.display, size: 54, min: 26, color: accentInk(d), lh: 1, ls: track(ctx, 54), nowrap: true, w: '210px', group: 'kh-v' })}<div style="flex:1;display:flex;flex-direction:column;gap:4px;min-width:0">${T(it.label ?? it.title, { font: d.style.heading, size: 22, min: 14, color: d.text, lines: 2, group: 'kh-l' })}${T(it.text, { font: d.style.light, size: 17, min: 12, color: d.muted, lines: 2, group: 'kh-b' })}</div></div>`,
      { pad: 24, gap: 0, extra: 'flex:1;justify-content:center' })).join('') + `</div>`;
    return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:flex;flex-direction:column;gap:24px;min-height:0"><div style="flex:1;display:flex;gap:22px;min-height:0;max-height:400px">${big}${side}</div>${take}</div>`, 'justify-content:center'), { notes: spec.notes });
  }
  // lines: ohne Karten, Kennzahl über einer Akzentlinie
  const cols = items.map((it, i) => `<div style="display:flex;flex-direction:column;gap:12px;min-width:0">` +
    `<div style="height:5px;width:64px;background:#${[d.primary, d.accent, d.accent2][i % 3]};border-radius:${d.style.radius ? 3 : 0}px;flex:none"></div>` +
    (it.icon ? iconSvg(it.icon, 34, accentInk(d)) : '') +
    T(it.value, { font: d.style.display, size: 72, min: 30, color: d.text, lh: 1, ls: track(ctx, 72), nowrap: true, w: '100%', group: 'kl-v' }) +
    T(it.label ?? it.title, { font: d.style.heading, size: 24, min: 15, color: d.text, lines: 2, w: '100%', group: 'kl-l' }) +
    T(it.text, { font: d.style.light, size: 18, min: 12, color: d.muted, lh: 1.4, lines: 3, w: '100%', group: 'kl-b' }) + `</div>`).join('');
  return frame(ctx, header(ctx, spec) + body(`<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:36px"><div style="display:grid;grid-template-columns:repeat(${items.length},1fr);gap:44px">${cols}</div>${take}</div>`), { notes: spec.notes });
}


function agendaSlide(spec: SlideSpec, ctx: Ctx) {
  const v = variant(ctx, spec, 'agenda', VARIANTS.agenda!);
  if (v === 'list') return agendaClassic(spec, ctx);
  const d = ctx.d;
  const items = list(spec, 8);
  if (v === 'split') {
    // Titel auf einer Farbfläche links, Punkte rechts
    const on = onColorSafe(d.primary);
    const panelBg = d.style.badge === 'gradient' ? `linear-gradient(160deg,#${d.primary} 0%,#${gradientEnd(d)} 100%)` : `#${d.primary}`;
    const brutal = d.style.card === 'brutal' ? 'border-right:3px solid #111418;' : '';
    const panel = `<div data-block="1" style="position:absolute;left:0;top:0;width:420px;height:720px;background:${panelBg};${brutal}"></div>` +
      `<div style="position:absolute;left:72px;top:0;width:290px;height:720px;display:flex;flex-direction:column;justify-content:center;gap:14px">${spec.kicker ? T(spec.kicker, { font: d.style.label, size: 15, color: on, ls: 2.5, upper: true, nowrap: true, min: 11, w: '100%' }) : ''}${T(spec.title ?? 'Agenda', { font: d.style.display, size: 54, min: 26, color: on, lh: 1.05, ls: track(ctx, 54), lines: 4, w: '100%', name: '!!title' })}</div>`;
    const rows = items.map((it, i) => `<div style="display:flex;gap:24px;align-items:center;min-height:0">${T(String(i + 1).padStart(2, '0'), { font: d.style.display, size: 34, min: 18, color: accentInk(d), nowrap: true, w: '64px', group: 'as-n' })}<div style="flex:1;display:flex;flex-direction:column;gap:4px;min-width:0">${T(it.title ?? it.text, { font: d.style.heading, size: 28, min: 16, color: d.text, lines: 1, nowrap: true, group: 'as-t' })}${it.title && it.text ? T(it.text, { font: d.style.light, size: 18, min: 12, color: d.muted, lines: 2, group: 'as-b' }) : ''}</div></div>`).join('');
    const right = `<div style="position:absolute;left:500px;top:0;width:700px;height:720px;display:flex;flex-direction:column;justify-content:center;gap:${items.length > 5 ? 20 : 30}px">${rows}</div>`;
    return frame(ctx, '', { under: panel + right, pad: '0', notes: spec.notes, noDeco: true });
  }
  // cards: Punkte als nummerierte Kacheln
  const cols = items.length <= 4 ? items.length : Math.ceil(items.length / 2);
  const grid = `<div style="display:grid;grid-template-columns:repeat(${Math.max(cols, 1)},1fr);gap:18px;min-height:0">` +
    items.map((it, i) => card(ctx, numberMark(ctx, i + 1, 50) + `<div style="height:8px;flex:none"></div>` + T(it.title ?? it.text, { font: d.style.heading, size: 24, min: 14, color: d.text, lines: 2, group: 'ac-t' }) + (it.title && it.text ? T(it.text, { font: d.style.light, size: 17, min: 12, color: d.muted, lines: 3, group: 'ac-b' }) : ''), { pad: 26, gap: 6 })).join('') +
    `</div>`;
  return frame(ctx, header(ctx, spec) + body(grid, 'justify-content:center'), { notes: spec.notes });
}

function processSlide(spec: SlideSpec, ctx: Ctx) {
  const v = variant(ctx, spec, 'process', VARIANTS.process!);
  if (v === 'steps') return processClassic(spec, ctx);
  const d = ctx.d;
  const items = list(spec, 5);
  const n = Math.max(items.length, 1);
  if (v === 'cards') {
    // Schritte als Karten mit Pfeilen dazwischen
    const arrow = `<div style="display:flex;align-items:center;justify-content:center;width:28px;flex:none">${iconSvg('arrow right', 26, d.style.dark ? d.muted : d.faint)}</div>`;
    const cards = items.map((it, i) => card(ctx,
      `<div style="display:flex;align-items:center;justify-content:space-between">${numberMark(ctx, i + 1, 46, i === n - 1 ? 'highlight' : 'default')}${it.icon ? iconSvg(it.icon, 30, accentInk(d)) : ''}</div>` +
      `<div style="height:6px;flex:none"></div>` +
      T(it.title, { font: d.style.heading, size: n >= 5 ? 21 : 24, min: 14, color: d.text, lines: 2, group: 'pc-t' }) +
      T(it.text, { font: d.style.light, size: n >= 5 ? 16 : 18, min: 12, color: d.muted, lh: 1.4, lines: 5, group: 'pc-b' }),
      { pad: 24, gap: 8, extra: 'flex:1' })).join(arrow);
    return frame(ctx, header(ctx, spec) + body(`<div style="display:flex;align-items:stretch;gap:6px;min-height:0">${cards}</div>`, 'justify-content:center'), { notes: spec.notes });
  }
  // vertical: senkrechte Linie mit Stationen
  const lineCol = d.style.dark ? 'rgba(255,255,255,0.18)' : rgba(d.primary, 0.25);
  const rows = items.map((it, i) => `<div style="display:flex;gap:26px;align-items:flex-start;position:relative;min-height:0">` +
    (i < n - 1 ? `<div style="position:absolute;left:25px;top:52px;width:2px;height:calc(100% - 22px);background:${lineCol}"></div>` : '') +
    numberMark(ctx, i + 1, 52, i === n - 1 ? 'highlight' : 'default') +
    `<div style="flex:1;display:flex;gap:28px;align-items:baseline;min-width:0;padding-top:10px"><div style="width:320px;flex:none">${T(it.title, { font: d.style.heading, size: 25, min: 15, color: d.text, lines: 2, group: 'pv-t' })}</div>${T(it.text, { font: d.style.light, size: 19, min: 12, color: d.muted, lh: 1.4, lines: 2, grow: true, group: 'pv-b' })}</div>` +
    `</div>`).join('');
  return frame(ctx, header(ctx, spec) + body(`<div style="display:flex;flex-direction:column;gap:${n > 4 ? 16 : 26}px">${rows}</div>`, 'justify-content:center'), { notes: spec.notes });
}

function iconGridSlide(spec: SlideSpec, ctx: Ctx) {
  const v = variant(ctx, spec, 'icon_grid', VARIANTS.icon_grid!);
  if (v === 'plain') return iconGridClassic(spec, ctx);
  const d = ctx.d;
  const items = list(spec, 8);
  const n = Math.max(items.length, 1);
  const cols = n <= 3 ? n : n === 4 ? 4 : n <= 6 ? 3 : 4;
  // centered: Icons in Plaketten, Text mittig
  const grid = `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);column-gap:40px;row-gap:40px;min-height:0">` +
    items.map((it) => `<div style="display:flex;flex-direction:column;align-items:center;gap:14px;min-height:0">${badge(ctx, it.icon || 'star', 76)}${T(it.title, { font: d.style.heading, size: 25, min: 15, color: d.text, align: 'center', lines: 2, w: '100%', group: 'gc-t' })}${T(it.text, { font: d.style.light, size: 18, min: 12, color: d.muted, align: 'center', lh: 1.4, lines: 3, w: '100%', group: 'gc-b' })}</div>`).join('') +
    `</div>`;
  return frame(ctx, header(ctx, spec) + body(grid, 'justify-content:center'), { notes: spec.notes });
}

function timelineSlide(spec: SlideSpec, ctx: Ctx) {
  const v = variant(ctx, spec, 'timeline', VARIANTS.timeline!);
  if (v === 'horizontal') return timelineClassic(spec, ctx);
  const d = ctx.d;
  const items = list(spec, 6);
  const n = Math.max(items.length, 1);
  // vertical: Zeitpunkte links, Linie, Einträge rechts
  const lineCol = d.style.dark ? 'rgba(255,255,255,0.2)' : rgba(d.primary, 0.3);
  const rows = items.map((it, i) => `<div style="display:flex;gap:26px;align-items:flex-start;position:relative;min-height:0">` +
    `<div style="width:170px;flex:none;padding-top:2px">${T(it.date ?? it.label, { font: d.style.display, size: 26, min: 15, color: accentInk(d), nowrap: true, align: 'right', w: '100%', group: 'tv-d' })}</div>` +
    `<div style="position:relative;width:22px;flex:none;align-self:stretch">${i < n - 1 ? `<div style="position:absolute;left:10px;top:18px;width:2px;height:calc(100% + ${n > 4 ? 14 : 22}px);background:${lineCol}"></div>` : ''}<div style="position:absolute;left:2px;top:6px;width:18px;height:18px;border-radius:9px;background:#${i === n - 1 ? d.accent : d.primary}"></div></div>` +
    `<div style="flex:1;display:flex;flex-direction:column;gap:4px;min-width:0">${T(it.title, { font: d.style.heading, size: 24, min: 15, color: d.text, lines: 1, nowrap: true, group: 'tv-t' })}${T(it.text, { font: d.style.light, size: 18, min: 12, color: d.muted, lh: 1.4, lines: 2, group: 'tv-b' })}</div>` +
    `</div>`).join('');
  return frame(ctx, header(ctx, spec) + body(`<div style="display:flex;flex-direction:column;gap:${n > 4 ? 14 : 22}px">${rows}</div>`, 'justify-content:center'), { notes: spec.notes });
}

const RENDERERS: Record<LayoutName, (spec: SlideSpec, ctx: Ctx) => string> = {
  title: titleSlide, section: sectionSlide, agenda: agendaSlide, statement: statementSlide, big_number: bigNumberSlide,
  quote: quoteSlide, closing: closingSlide, bullets: bulletsSlide, split: splitSlide, cards: cardsSlide,
  icon_grid: iconGridSlide, icon_rows: iconRowsSlide, bento: bentoSlide, kpis: kpisSlide, progress: progressSlide,
  chart: chartSlide, table: tableSlide, comparison: comparisonSlide, options: optionsSlide, process: processSlide,
  timeline: timelineSlide, cycle: cycleSlide, funnel: funnelSlide, pyramid: pyramidSlide, matrix: matrixSlide,
  swot: swotSlide, checklist: checklistSlide, people: peopleSlide,
  image_hero: imageHeroSlide, image_split: imageSplitSlide, image_grid: imageGridSlide, image_cards: imageCardsSlide,
  image_quote: imageQuoteSlide, image_stat: imageStatSlide, stat_row: statRowSlide, numbered: numberedSlide,
  testimonials: testimonialsSlide, roadmap: roadmapSlide, giant: giantSlide, faq: faqSlide,
};

/** HTML einer Folie */
export function slideHtml(spec: SlideSpec, ctx: Ctx): string {
  const r = RENDERERS[spec.layout] ?? bulletsSlide;
  return r(spec, ctx);
}
