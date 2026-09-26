// Bausteine für die HTML-Layouts (Raster 1280 × 720 px = 13,333 × 7,5 Zoll).
// Jeder Text ist ein eigenes <div data-fit>: Die Engine verkleinert ihn nach dem
// Rendern, bis er passt, und dom-to-pptx macht daraus ein bearbeitbares Textfeld.
import { iconSvg } from './icons';
import { imageSrc } from './images';
import { gradientEnd, mix, onColor, rgba, shade, tint, type Design } from './styles';

export const W = 1280;
export const H = 720;

export interface Ctx {
  d: Design;
  /** Position der Folie im Deck (für Varianten und Morph-Bewegung) */
  index: number;
}

export const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export interface TextOpts {
  font: string;
  size: number;
  min?: number;
  color: string;
  lh?: number;
  /** Laufweite in px */
  ls?: number;
  align?: 'left' | 'center' | 'right';
  w?: string;
  h?: string;
  /** Maximale Zeilenzahl (setzt max-height) */
  lines?: number;
  nowrap?: boolean;
  /** Gleichrangige Texte bekommen dieselbe Größe */
  group?: string;
  italic?: boolean;
  bold?: boolean;
  upper?: boolean;
  /** Füllt den restlichen Platz in einer Flex-Spalte */
  grow?: boolean;
  name?: string;
  extra?: string;
}

/** Ein Textblock, der garantiert in seine Box passt. */
export function T(text: unknown, o: TextOpts): string {
  const value = String(text ?? '').trim();
  if (!value) return '';
  const lh = o.lh ?? 1.2;
  const min = o.min ?? Math.max(12, Math.round(o.size * 0.55));
  const style = [
    `font-family:'${o.font}'`,
    `font-size:${o.size}px`,
    `line-height:${lh}`,
    `color:#${o.color}`,
    o.ls != null ? `letter-spacing:${o.ls}px` : '',
    `text-align:${o.align ?? 'left'}`,
    o.w ? `width:${o.w}` : '',
    o.h ? `height:${o.h}` : '',
    o.lines ? `max-height:${Math.ceil(o.lines * lh * o.size) + 2}px` : '',
    o.grow ? 'flex:1 1 auto;min-height:0' : 'flex:none',
    'overflow:hidden',
    'overflow-wrap:normal',
    'word-break:normal',
    o.nowrap ? 'white-space:nowrap' : '',
    o.italic ? 'font-style:italic' : '',
    o.bold ? 'font-weight:700' : 'font-weight:400',
    o.upper ? 'text-transform:uppercase' : '',
    o.extra ?? '',
  ]
    .filter(Boolean)
    .join(';');
  return `<div data-fit="${min}"${o.lines ? ` data-lines="${o.lines}"` : ''}${o.group ? ` data-fit-group="${o.group}"` : ''}${o.name ? ` data-pptx-name="${o.name}"` : ''} style="${style}">${esc(value)}</div>`;
}

/** Laufweite für große Schrift je Stil */
export const track = (ctx: Ctx, size: number) => Math.round((ctx.d.style.tracking * size) / 100 * 10) / 10;

/** Akzentfarbe für Überzeilen, Nummern, Icons auf dem Folienhintergrund */
export const accentInk = (d: Design) => (d.style.dark ? d.accent : d.style.id === 'mono' ? d.accent : d.primary);

/** Farben auf Heldenfolien: beim Stil „gradient“ liegt Text auf einem Farbverlauf. */
export function heroInk(d: Design, hero: boolean): { text: string; muted: string; kicker: string } {
  if (hero && d.style.decoration === 'gradient') return { text: 'FFFFFF', muted: mix(d.primary, 'FFFFFF', 0.82), kicker: 'FFFFFF' };
  return { text: d.text, muted: d.muted, kicker: accentInk(d) };
}

export type Tone = 'default' | 'primary' | 'accent' | 'dark' | 'soft';

/** Farben für Text auf einer Karte je Tonalität */
export function toneText(ctx: Ctx, tone: Tone): { text: string; muted: string; icon: string } {
  const d = ctx.d;
  if (tone === 'primary') return { text: d.onPrimary, muted: d.onPrimary === 'FFFFFF' ? tint(d.primary, 0.75) : shade(d.primary, 0.55), icon: d.onPrimary };
  if (tone === 'accent') {
    const on = onColor(d.accent);
    return { text: on, muted: on === 'FFFFFF' ? tint(d.accent, 0.75) : shade(d.accent, 0.6), icon: on };
  }
  if (tone === 'dark') return { text: 'FFFFFF', muted: 'B8BCC8', icon: d.style.dark ? d.accent : tint(d.primary, 0.4) };
  if (tone === 'soft' && d.style.id === 'noir') return { text: d.text, muted: d.muted, icon: d.accent };
  return { text: d.text, muted: d.muted, icon: accentInk(d) };
}

/** Hintergrund + Rahmen + Schatten einer Karte je Stil und Tonalität */
export function cardCss(ctx: Ctx, tone: Tone = 'default'): string {
  const d = ctx.d;
  const r = `border-radius:${d.style.radius}px`;
  const brutal = d.style.card === 'brutal' ? ';border:2.5px solid #111418;box-shadow:7px 7px 0 #111418' : '';
  if (tone === 'primary') {
    if (d.style.card === 'brutal' || d.style.card === 'line') return `${r};background:#${d.primary}${brutal}`;
    const end = gradientEnd(d, d.style.dark || d.style.id === 'bento' || d.style.id === 'gradient' || d.style.id === 'glass');
    return `${r};background:linear-gradient(135deg,#${d.primary} 0%,#${end} 100%)` + (d.style.card === 'elevated' ? ';box-shadow:0 18px 40px ' + rgba(d.primary, 0.28) : '');
  }
  if (tone === 'accent') return `${r};background:#${d.accent}${brutal}`;
  if (tone === 'dark') return `${r};background:#${d.style.dark ? mix(d.bg, 'FFFFFF', 0.12) : '15171C'}${brutal}`;
  if (tone === 'soft') {
    if (d.style.id === 'noir') return `${r};background:${rgba(d.primary, 0.1)};border:1px solid ${rgba(d.primary, 0.45)}`;
    if (d.style.card === 'brutal') return `${r};background:#${d.accent2}${brutal}`;
    return `${r};background:#${d.style.dark ? mix(d.bg, d.primary, 0.22) : tint(d.primary, 0.86)}`;
  }
  switch (d.style.card) {
    case 'glass':
      return `${r};background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);box-shadow:0 24px 48px rgba(0,0,0,0.35)`;
    case 'frost':
      return `${r};background:rgba(255,255,255,0.62);border:1.5px solid rgba(255,255,255,0.95);box-shadow:0 20px 48px ${rgba(shade(d.primary, 0.6), 0.12)}`;
    case 'elevated':
      return `${r};background:#FFFFFF;box-shadow:0 1px 2px rgba(0,0,0,0.04),0 16px 36px rgba(0,0,0,0.07)`;
    case 'brutal':
      return `${r};background:#FFFFFF${brutal}`;
    case 'line':
      return `${r};border:1px solid ${d.style.dark ? rgba(d.style.id === 'noir' ? d.primary : 'FFFFFF', d.style.id === 'noir' ? 0.45 : 0.28) : 'rgba(17,20,24,0.14)'};background:${d.style.dark ? 'rgba(255,255,255,0.02)' : '#' + d.bg}`;
    case 'outline':
      return `${r};border:1.5px solid ${d.style.dark ? 'rgba(255,255,255,0.18)' : 'rgba(17,20,24,0.14)'};background:${d.style.dark ? 'rgba(255,255,255,0.03)' : '#' + d.bg}`;
    case 'tint':
      return `${r};background:#${d.surface}`;
    case 'plain':
    default:
      return `border-top:2px solid #${d.text};border-radius:0`;
  }
}

/** Karte als Flex-Spalte */
export function card(ctx: Ctx, inner: string, o: { tone?: Tone; pad?: number; extra?: string; gap?: number; name?: string } = {}): string {
  const pad = o.pad ?? (ctx.d.style.card === 'plain' ? 0 : 30);
  const padCss = ctx.d.style.card === 'plain' && (o.tone ?? 'default') === 'default' ? `padding:${pad + 22}px 0 0 0` : `padding:${pad}px`;
  return `<div data-block="1"${o.name ? ` data-pptx-name="${o.name}"` : ''} style="${cardCss(ctx, o.tone)};${padCss};box-sizing:border-box;display:flex;flex-direction:column;gap:${o.gap ?? 12}px;min-width:0;min-height:0;overflow:hidden;${o.extra ?? ''}">${inner}</div>`;
}

/** Icon im Stil der Präsentation */
export function badge(ctx: Ctx, query: string | undefined, size = 56, tone: Tone = 'default'): string {
  if (!query) return '';
  const d = ctx.d;
  const onTone = tone === 'primary' || tone === 'accent' || tone === 'dark';
  const box = (bg: string, radius: number, icon: string, extra = '') =>
    `<div style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${bg};display:flex;align-items:center;justify-content:center;flex:none;box-sizing:border-box;${extra}">${icon}</div>`;
  switch (d.style.badge) {
    case 'glow': {
      const col = onTone ? toneText(ctx, tone).icon : d.accent;
      const bg = onTone ? 'rgba(255,255,255,0.14)' : rgba(d.style.id === 'keynote' ? d.primary : d.accent, 0.16);
      return box(bg, Math.round(size * 0.3), iconSvg(query, Math.round(size * 0.56), d.style.id === 'keynote' && !onTone ? tint(d.primary, 0.3) : col));
    }
    case 'bare': {
      const col = onTone ? toneText(ctx, tone).icon : d.style.id === 'swiss' ? d.text : accentInk(d);
      return `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;flex:none">${iconSvg(query, Math.round(size * 0.8), col)}</div>`;
    }
    case 'square': {
      const bg = onTone ? 'FFFFFF' : d.primary;
      return box('#' + bg, 0, iconSvg(query, Math.round(size * 0.56), onTone ? d.primary : d.onPrimary, 'filled'));
    }
    case 'soft': {
      const bg = onTone ? 'rgba(255,255,255,0.22)' : '#' + tint(d.primary, d.style.id === 'pastel' ? 0.72 : 0.86);
      return box(bg, Math.round(size * 0.32), iconSvg(query, Math.round(size * 0.55), onTone ? 'FFFFFF' : d.style.id === 'pastel' ? shade(d.primary, 0.25) : d.primary, 'filled'));
    }
    case 'outline': {
      const col = onTone ? toneText(ctx, tone).icon : accentInk(d);
      const radius = d.style.id === 'mono' || d.style.id === 'blueprint' ? Math.round(size * 0.22) : size / 2;
      return box('transparent', radius, iconSvg(query, Math.round(size * 0.5), col), `border:1.5px solid ${rgba(col, 0.55)}`);
    }
    case 'brutal': {
      const cols = [d.primary, d.accent, d.accent2];
      const bg = onTone ? 'FFFFFF' : cols[(ctx.index + size) % 3];
      return box('#' + bg, Math.round(size * 0.22), iconSvg(query, Math.round(size * 0.54), onTone ? '111418' : onColor(bg), 'filled'), 'border:2.5px solid #111418;box-shadow:4px 4px 0 #111418');
    }
    case 'gradient': {
      if (onTone) return box('rgba(255,255,255,0.2)', Math.round(size * 0.3), iconSvg(query, Math.round(size * 0.55), 'FFFFFF', 'filled'));
      return box(`linear-gradient(135deg,#${d.primary} 0%,#${d.accent2} 100%)`, Math.round(size * 0.3), iconSvg(query, Math.round(size * 0.55), 'FFFFFF', 'filled'));
    }
    case 'round':
    default: {
      const colors = d.style.id === 'playful' ? [d.primary, d.accent, d.accent2] : [d.primary];
      const bg = onTone ? 'rgba(255,255,255,0.18)' : '#' + colors[(ctx.index + size) % colors.length];
      return box(bg, size / 2, iconSvg(query, Math.round(size * 0.52), onTone ? toneText(ctx, tone).icon : onColor(bg.replace('#', '').length === 6 ? bg.replace('#', '') : d.primary), 'filled'));
    }
  }
}

/** Nummer im Stil (für Agenda, Prozess, Schritte) */
export function numberMark(ctx: Ctx, n: number, size = 48, tone: Tone | 'highlight' = 'default'): string {
  const d = ctx.d;
  const label = String(n).padStart(2, '0');
  if (tone === 'highlight') {
    // Hervorgehobene Nummer direkt auf dem Folienhintergrund
    if (d.style.numbers === 'type') {
      return T(label, { font: d.style.display, size: Math.round(size * 0.9), color: d.style.dark ? d.accent2 : d.accent, nowrap: true, ls: track(ctx, size), min: 14, w: `${size * 1.6}px` });
    }
    const c = d.style.dark ? d.accent : d.accent;
    const extra = d.style.badge === 'brutal' ? 'border:2.5px solid #111418;box-shadow:4px 4px 0 #111418;box-sizing:border-box;' : '';
    const r = d.style.badge === 'square' ? 0 : d.style.badge === 'soft' || d.style.badge === 'brutal' || d.style.badge === 'gradient' ? Math.round(size * 0.3) : size / 2;
    return `<div style="width:${size}px;height:${size}px;border-radius:${r}px;background:#${c};display:flex;align-items:center;justify-content:center;flex:none;${extra}">${T(label, { font: d.style.heading, size: Math.round(size * 0.4), color: onColor(c), nowrap: true, align: 'center', w: `${size}px`, min: 10 })}</div>`;
  }
  if (d.style.numbers === 'type') {
    const col = tone === 'default' ? (d.style.id === 'swiss' ? d.primary : accentInk(d)) : toneText(ctx, tone).text;
    return T(label, { font: d.style.display, size: Math.round(size * 0.9), color: col, nowrap: true, ls: track(ctx, size), min: 14, w: `${size * 1.6}px` });
  }
  let bg = tone === 'default' ? (d.style.dark ? rgba(d.accent, 0.16) : '#' + d.primary) : 'rgba(255,255,255,0.2)';
  let fg = tone === 'default' ? (d.style.dark ? d.accent : d.onPrimary) : toneText(ctx, tone).text;
  let extra = '';
  if (d.style.badge === 'gradient' && tone === 'default') {
    bg = `linear-gradient(135deg,#${d.primary} 0%,#${d.accent2} 100%)`;
    fg = 'FFFFFF';
  }
  if (d.style.badge === 'brutal') {
    const c = tone === 'default' ? [d.primary, d.accent, d.accent2][n % 3] : 'FFFFFF';
    bg = '#' + c;
    fg = onColor(c);
    extra = 'border:2.5px solid #111418;box-shadow:4px 4px 0 #111418;box-sizing:border-box';
  }
  if (d.style.id === 'playful' && tone === 'default') {
    const c = [d.primary, d.accent, d.accent2][n % 3];
    bg = '#' + c;
    fg = onColor(c);
  }
  const r = d.style.badge === 'square' ? 0 : d.style.badge === 'soft' || d.style.badge === 'brutal' || d.style.badge === 'gradient' ? Math.round(size * 0.3) : size / 2;
  return `<div style="width:${size}px;height:${size}px;border-radius:${r}px;background:${bg};display:flex;align-items:center;justify-content:center;flex:none;${extra}">${T(label, { font: d.style.heading, size: Math.round(size * 0.4), color: fg, nowrap: true, align: 'center', w: `${size}px`, min: 10 })}</div>`;
}

// ── Hintergrund-Dekoration ────────────────────────────────────────────────

/** SVG-Form (bleibt als Vektorgrafik erhalten) */
const svgShape = (name: string, x: number, y: number, w: number, h: number, body: string, deco = true) =>
  `<div${deco ? ' data-deco="1"' : ''} data-pptx-name="${name}" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px"><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block">${body}</svg></div>`;

/** Organische Blob-Form als SVG-Pfad (Variante 0–2) */
function blobPath(s: number, v: number) {
  const k = s / 200;
  const paths = [
    'M163,34C189,59,203,100,193,138C183,176,149,203,108,203C67,203,24,183,9,146C-6,109,5,62,34,35C63,8,137,9,163,34Z',
    'M170,46C196,78,196,124,176,160C156,196,116,212,78,202C40,192,6,158,3,117C0,76,28,29,67,12C106,-5,144,14,170,46Z',
    'M181,72C198,112,186,166,150,190C114,214,62,208,31,178C0,148,-8,96,15,58C38,20,86,-3,125,6C164,15,164,32,181,72Z',
  ];
  return `<path transform="scale(${k})" d="${paths[v % 3]}"/>`;
}

/** Hintergrund-Dekoration. Formen tragen feste Namen („!!…“), damit sie beim
 *  Morph-Übergang von Folie zu Folie gleiten. */
export function backdrop(ctx: Ctx, kind: 'hero' | 'content'): string {
  const d = ctx.d;
  const i = ctx.index + (d.seed % 5);
  const hero = kind === 'hero';
  // Weiche Farbfläche: im Browser nur ein Platzhalter – die Render-Pipeline setzt eine
  // native PowerPoint-Ellipse mit „Weiche Kanten“ ein (winzig, bearbeitbar, morph-fähig).
  const blob = (name: string, x: number, y: number, s: number, color: string, op: number, blur = 100) =>
    `<div data-soft="${esc(JSON.stringify({ name, x, y, s, color, op, blur }))}" style="display:none"></div>`;
  switch (d.style.decoration) {
    case 'aurora': {
      const pos = [
        [-180, -220, 640, 900, 360, 620, 640, 40, 380],
        [760, -260, 600, -200, 420, 560, 300, 520, 360],
        [-220, 380, 560, 880, -180, 600, 520, -120, 340],
      ][i % 3];
      if (hero) {
        return blob('!!aurora1', pos[0], pos[1], pos[2], d.primary, 0.78) + blob('!!aurora2', pos[3], pos[4], pos[5], d.accent, 0.55) + blob('!!aurora3', pos[6], pos[7], pos[8], d.accent2, 0.38, 120);
      }
      return blob('!!aurora1', 900, -380, 560, d.primary, 0.42) + blob('!!aurora2', -300, 520, 520, d.accent, 0.22) + blob('!!aurora3', 1100, 520, 300, d.accent2, 0.16, 120);
    }
    case 'mesh': {
      // Helle Pastell-Farbwolken (Glassmorphism)
      if (hero) {
        const p = [[-160, -200, 700], [720, -240, 640], [380, 360, 620], [-200, 420, 520]][0];
        return blob('!!mesh1', p[0] + (i % 2) * 60, p[1], p[2], tint(d.primary, 0.35), 0.75, 140) +
          blob('!!mesh2', 760 - (i % 2) * 80, -220, 640, tint(d.accent, 0.35), 0.7, 140) +
          blob('!!mesh3', 420, 380, 600, tint(d.accent2, 0.4), 0.6, 140) +
          blob('!!mesh4', -220, 420, 480, tint(d.accent, 0.5), 0.45, 140);
      }
      return blob('!!mesh1', 940, -360, 620, tint(d.primary, 0.4), 0.55, 140) +
        blob('!!mesh2', -320, 480, 560, tint(d.accent, 0.4), 0.45, 140) +
        blob('!!mesh3', 780, 560, 420, tint(d.accent2, 0.45), 0.35, 140);
    }
    case 'spot': {
      // Keynote: ein einzelner Lichtkegel
      if (hero) return blob('!!spot', 340 + (i % 3) * 120, 420, 760, d.primary, 0.45, 180);
      return blob('!!spot', 980, -420, 600, d.primary, 0.22, 180);
    }
    case 'gradient': {
      if (hero) {
        const ang = [135, 120, 150][i % 3];
        return `<div data-pptx-name="!!grad" style="position:absolute;left:0;top:0;width:${W}px;height:${H}px;background:linear-gradient(${ang}deg,#${d.primary} 0%,#${d.accent} 55%,#${d.accent2} 100%)"></div>` +
          blob('!!gradglow', 760, -260, 620, tint(d.accent2, 0.3), 0.55, 160) + blob('!!gradglow2', -260, 420, 560, d.primary, 0.5, 160);
      }
      return `<div data-pptx-name="!!gradbar" style="position:absolute;left:0;top:0;width:${W}px;height:8px;background:linear-gradient(90deg,#${d.primary} 0%,#${d.accent} 55%,#${d.accent2} 100%)"></div>` +
        blob('!!gradglow', 1040, -380, 520, tint(d.accent, 0.4), 0.35, 160);
    }
    case 'grid': {
      let lines = '';
      for (let x = 80; x < W; x += 80) lines += `<div style="position:absolute;left:${x}px;top:0;width:1px;height:${H}px;background:rgba(255,255,255,0.045)"></div>`;
      for (let y = 80; y < H; y += 80) lines += `<div style="position:absolute;left:0;top:${y}px;width:${W}px;height:1px;background:rgba(255,255,255,0.045)"></div>`;
      const g = hero ? blob('!!glow', 760, -120, 620, d.primary, 0.35, 140) : blob('!!glow', 1000, -300, 480, d.primary, 0.18, 140);
      return lines + g;
    }
    case 'blueprint': {
      let lines = '';
      for (let x = 64; x < W; x += 64) lines += `<div style="position:absolute;left:${x}px;top:0;width:1px;height:${H}px;background:rgba(255,255,255,${x % 320 === 0 ? 0.13 : 0.05})"></div>`;
      for (let y = 64; y < H; y += 64) lines += `<div style="position:absolute;left:0;top:${y}px;width:${W}px;height:1px;background:rgba(255,255,255,${y % 320 === 0 ? 0.13 : 0.05})"></div>`;
      // Messmarken in den Ecken
      const mark = (x: number, y: number) => svgShape('!!mark' + x + y, x, y, 28, 28, `<path d="M14 0V28M0 14H28" stroke="#${d.accent}" stroke-width="1.5"/><circle cx="14" cy="14" r="6" fill="none" stroke="#${d.accent}" stroke-width="1.5"/>`, false);
      return lines + mark(22, 18) + mark(W - 50, 18) + mark(22, H - 46) + mark(W - 50, H - 46) + (hero ? blob('!!glow', 700, 200, 620, d.accent2, 0.18, 160) : '');
    }
    case 'blocks': {
      if (hero) {
        return `<div data-pptx-name="!!block1" style="position:absolute;left:0;top:0;width:600px;height:${H}px;background:#${d.primary}"></div>` +
          `<div data-deco="1" data-pptx-name="!!block2" style="position:absolute;left:${i % 2 ? 930 : 860}px;top:${i % 2 ? 330 : 250}px;width:360px;height:360px;border-radius:50%;background:#${d.accent}"></div>` +
          `<div data-deco="1" data-pptx-name="!!block3" style="position:absolute;left:1040px;top:60px;width:160px;height:160px;background:#${d.accent2}"></div>`;
      }
      return `<div data-deco="1" data-pptx-name="!!block2" style="position:absolute;left:1195px;top:655px;width:230px;height:230px;border-radius:50%;background:#${tint(d.accent, 0.72)}"></div>` +
        `<div data-deco="1" data-pptx-name="!!block3" style="position:absolute;left:1190px;top:-60px;width:150px;height:150px;background:#${tint(d.accent2, 0.6)}"></div>`;
    }
    case 'orbs': {
      if (hero) {
        return `<div data-deco="1" data-pptx-name="!!orb1" style="position:absolute;left:780px;top:90px;width:560px;height:560px;border-radius:280px;background:linear-gradient(135deg,#${d.primary} 0%,#${shade(d.primary, 0.35)} 100%)"></div>` +
          `<div data-deco="1" data-pptx-name="!!orb2" style="position:absolute;left:1080px;top:470px;width:220px;height:220px;border-radius:50%;background:#${d.accent}"></div>`;
      }
      return `<div data-deco="1" data-pptx-name="!!orb1" style="position:absolute;left:1110px;top:-150px;width:320px;height:320px;border-radius:50%;background:#${tint(d.primary, 0.9)}"></div>` +
        `<div data-deco="1" data-pptx-name="!!orb2" style="position:absolute;left:1210px;top:120px;width:90px;height:90px;border-radius:50%;background:#${tint(d.accent, 0.7)}"></div>`;
    }
    case 'bubbles': {
      // Pastell-Kreise (flach, ohne Verlauf)
      if (hero) {
        return `<div data-deco="1" data-pptx-name="!!bub1" style="position:absolute;left:${i % 2 ? 860 : 900}px;top:-120px;width:520px;height:520px;border-radius:260px;background:#${tint(d.primary, 0.7)}"></div>` +
          `<div data-deco="1" data-pptx-name="!!bub2" style="position:absolute;left:760px;top:430px;width:300px;height:300px;border-radius:150px;background:#${tint(d.accent, 0.62)}"></div>` +
          `<div data-deco="1" data-pptx-name="!!bub3" style="position:absolute;left:1120px;top:440px;width:130px;height:130px;border-radius:65px;background:#${tint(d.accent2, 0.5)}"></div>`;
      }
      return `<div data-deco="1" data-pptx-name="!!bub1" style="position:absolute;left:1150px;top:-110px;width:240px;height:240px;border-radius:120px;background:#${tint(d.primary, 0.75)}"></div>` +
        `<div data-deco="1" data-pptx-name="!!bub3" style="position:absolute;left:-50px;top:650px;width:120px;height:120px;border-radius:60px;background:#${tint(d.accent2, 0.55)}"></div>`;
    }
    case 'organic': {
      const c1 = tint(d.primary, 0.72);
      const c2 = tint(d.accent, 0.62);
      if (hero) {
        return svgShape('!!leaf1', i % 2 ? 820 : 860, -140, 560, 560, `<g fill="#${c1}">${blobPath(560, i)}</g>`) +
          svgShape('!!leaf2', 1000, 430, 360, 360, `<g fill="#${c2}">${blobPath(360, i + 1)}</g>`);
      }
      return svgShape('!!leaf1', 1130, -150, 300, 300, `<g fill="#${c1}">${blobPath(300, i)}</g>`) +
        svgShape('!!leaf2', -120, 620, 220, 220, `<g fill="#${c2}">${blobPath(220, i + 1)}</g>`);
    }
    case 'confetti': {
      const c = [d.primary, d.accent, d.accent2];
      const circle = (n: string, x: number, y: number, s: number, col: string) => svgShape(n, x, y, s, s, `<circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}" fill="#${col}"/>`);
      const ring = (n: string, x: number, y: number, s: number, col: string) => svgShape(n, x, y, s, s, `<circle cx="${s / 2}" cy="${s / 2}" r="${s / 2 - 5}" fill="none" stroke="#${col}" stroke-width="9"/>`);
      const tri = (n: string, x: number, y: number, s: number, col: string) => svgShape(n, x, y, s, s, `<path d="M${s / 2} 4L${s - 4} ${s - 6}H4Z" fill="#${col}"/>`);
      const squig = (n: string, x: number, y: number, col: string) => svgShape(n, x, y, 150, 44, `<path d="M6 22C20 4 34 4 48 22S76 40 90 22S118 4 132 22S146 40 146 30" fill="none" stroke="#${col}" stroke-width="8" stroke-linecap="round"/>`);
      if (hero) {
        return circle('!!c1', 1010, 70, 110, c[0]) + ring('!!c2', 1120, 300, 96, c[1]) + tri('!!c3', 900, 520, 86, c[2]) + squig('!!c4', 1060, 600, c[0]) +
          circle('!!c5', 820, 180, 34, c[1]) + tri('!!c6', 1180, 180, 48, c[0]);
      }
      return circle('!!c1', 1215, 24, 42, c[0]) + ring('!!c2', 1180, 640, 56, c[1]) + tri('!!c3', 24, 666, 40, c[2]);
    }
    case 'hairline': {
      // Noir: feiner Goldrahmen
      const line = rgba(d.primary, 0.55);
      if (hero) {
        return `<div style="position:absolute;left:36px;top:36px;width:${W - 72}px;height:${H - 72}px;border:1px solid ${line};box-sizing:border-box"></div>` +
          `<div style="position:absolute;left:48px;top:48px;width:${W - 96}px;height:${H - 96}px;border:1px solid ${rgba(d.primary, 0.22)};box-sizing:border-box"></div>`;
      }
      return `<div style="position:absolute;left:72px;top:40px;width:${W - 144}px;height:1px;background:${line}"></div>` +
        `<div data-edge="1" style="position:absolute;left:${W - 72 - 60}px;top:14px;width:60px">${T(String(ctx.index + 1).padStart(2, '0'), { font: d.style.label, size: 14, color: d.primary, align: 'right', nowrap: true, w: '60px', min: 10, ls: 2 })}</div>`;
    }
    case 'rules': {
      if (hero) return '';
      const col = d.style.dark ? 'rgba(255,255,255,0.2)' : rgba(d.text, 0.85);
      return `<div style="position:absolute;left:72px;top:40px;width:${W - 144}px;height:1px;background:${col}"></div>` +
        `<div data-edge="1" style="position:absolute;left:${W - 72 - 60}px;top:14px;width:60px">${T(String(ctx.index + 1).padStart(2, '0'), { font: d.style.label, size: 14, color: d.muted, align: 'right', nowrap: true, w: '60px', min: 10 })}</div>`;
    }
    default:
      return '';
  }
}

/** Kopfbereich: Überzeile, Titel (max. 2 Zeilen), Untertitel */
export function header(ctx: Ctx, spec: { kicker?: string; title?: string; subtitle?: string }, o: { color?: string; muted?: string; size?: number; w?: string } = {}): string {
  const d = ctx.d;
  const size = o.size ?? d.style.titleSize;
  const kicker = spec.kicker
    ? T(d.style.label === 'Consolas' ? `// ${spec.kicker}` : spec.kicker, { font: d.style.label, size: 15, color: accentInk(d), ls: d.style.label === 'Consolas' ? 0.5 : 2.5, upper: d.style.kickerUpper, nowrap: true, min: 11, w: o.w ?? '100%' })
    : '';
  const title = T(spec.title, { font: d.style.display, size, min: 26, color: o.color ?? d.text, lh: 1.08, ls: track(ctx, size), lines: 2, w: o.w ?? '100%', name: '!!title' });
  const sub = spec.subtitle ? T(spec.subtitle, { font: d.style.light, size: 21, min: 14, color: o.muted ?? d.muted, lines: 2, w: o.w ?? '100%' }) : '';
  return `<div style="display:flex;flex-direction:column;gap:10px;flex:none">${kicker}${title}${sub}</div>`;
}

/** Folienrahmen: Hintergrund, Dekoration, Inhalt als Flex-Spalte mit Rändern. */
export function frame(ctx: Ctx, inner: string, o: { hero?: boolean; bg?: string; pad?: string; gap?: number; notes?: string; justify?: string; under?: string; noDeco?: boolean } = {}): string {
  const d = ctx.d;
  const bg = o.bg ?? d.bg;
  const notes = o.notes ? ` data-pptx-notes="${esc(o.notes)}"` : '';
  return `<div class="slide"${notes} style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#${bg};font-family:'${d.style.body}'">` +
    (o.noDeco ? '' : backdrop(ctx, o.hero ? 'hero' : 'content')) +
    (o.under ?? '') +
    `<div style="position:absolute;left:0;top:0;width:${W}px;height:${H}px;box-sizing:border-box;padding:${o.pad ?? '64px 72px 52px 72px'};display:flex;flex-direction:column;gap:${o.gap ?? 30}px;justify-content:${o.justify ?? 'flex-start'}">${inner}</div></div>`;
}

/** Inhaltsbereich unter dem Titel */
export const body = (inner: string, extra = '') => `<div style="flex:1 1 auto;min-height:0;display:flex;flex-direction:column;${extra}">${inner}</div>`;

// ── Fotos ──────────────────────────────────────────────────────────────────

export interface PhotoOpts {
  /** CSS-Maße (px oder %) */
  w: string;
  h: string;
  radius?: number;
  /** Bildausschnitt, z. B. "50% 30%" */
  focus?: string;
  /** Absolute Position (optional) */
  abs?: { x: number; y: number };
  /** Abdunklung für Text auf dem Bild: Richtung des Verlaufs */
  scrim?: 'bottom' | 'left' | 'full' | 'none';
  credit?: string;
  name?: string;
  extra?: string;
}

/** Foto (object-fit: cover), optional mit Abdunklung und Bildnachweis. */
export function photo(src: string | undefined, o: PhotoOpts): string {
  const url = imageSrc(src);
  const pos = o.abs ? `position:absolute;left:${o.abs.x}px;top:${o.abs.y}px;` : 'position:relative;';
  const r = o.radius ?? 0;
  if (!url) {
    // Platzhalter, falls kein Bild angegeben ist
    return `<div data-block="1" style="${pos}width:${o.w};height:${o.h};border-radius:${r}px;background:linear-gradient(135deg,#9AA0AB 0%,#C9CDD4 100%);flex:none;${o.extra ?? ''}"></div>`;
  }
  const scrim =
    o.scrim === 'bottom' ? 'linear-gradient(0deg,rgba(0,0,0,0.78) 0%,rgba(0,0,0,0.35) 45%,rgba(0,0,0,0) 75%)'
      : o.scrim === 'left' ? 'linear-gradient(90deg,rgba(0,0,0,0.8) 0%,rgba(0,0,0,0.45) 45%,rgba(0,0,0,0) 80%)'
        : o.scrim === 'full' ? 'linear-gradient(0deg,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0.55) 100%)'
          : '';
  const credit = o.credit
    ? `<div data-credit="1" style="position:absolute;right:${Math.max(10, r / 2)}px;bottom:8px;max-width:70%;font-family:'Segoe UI';font-size:10px;line-height:1.2;color:rgba(255,255,255,0.85);text-align:right;white-space:nowrap;overflow:hidden">${esc(o.credit)}</div>`
    : '';
  return `<div data-photo="1" style="${pos}width:${o.w};height:${o.h};border-radius:${r}px;overflow:hidden;flex:none;${o.extra ?? ''}">` +
    `<img src="${esc(url)}" data-src="${esc(src)}" style="position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;object-position:${o.focus ?? '50% 50%'};border-radius:${r}px"${o.name ? ` data-pptx-name="${o.name}"` : ''}/>` +
    (scrim ? `<div style="position:absolute;left:0;top:0;width:100%;height:100%;background:${scrim};border-radius:${r}px"></div>` : '') +
    credit +
    `</div>`;
}

// ── Varianten ──────────────────────────────────────────────────────────────
// Jede Präsentation hat eine „Design-Signatur“ (seed). Sie wählt je Layout eine Variante:
// innerhalb einer Präsentation einheitlich, zwischen Präsentationen verschieden.
// Das Modell kann pro Folie mit „variant“ gezielt eine andere wählen.

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function variant<T extends string>(ctx: Ctx, spec: { variant?: string }, layout: string, options: readonly T[]): T {
  if (spec.variant && (options as readonly string[]).includes(spec.variant)) return spec.variant as T;
  // Je Signatur ein anderer Startpunkt, dann je Folie weiter rotieren: Wiederholt sich ein
  // Layout im Deck, sieht es trotzdem anders aus
  return options[(hash(`${ctx.d.seed}:${layout}`) + ctx.index * 7) % options.length];
}

// ── Illustration ───────────────────────────────────────────────────────────

/** Spot-Illustration: großes Icon auf einer Grundform mit geometrischen Akzenten
 *  (Ring, Punkteraster, Kreis, Plus, Welle) – Formensprache und Farben je Stil, Anordnung
 *  je Design-Signatur. Alles native Formen/Vektoren, in PowerPoint bearbeitbar. */
export function illustration(ctx: Ctx, icon: string | undefined, size: number, o: { x?: number; y?: number; seed?: number; onColor?: boolean } = {}): string {
  const d = ctx.d;
  const s = size;
  const seed = hash(`${d.seed}:${o.seed ?? ctx.index}:${icon ?? ''}`);
  const pick = <T,>(arr: T[], k: number) => arr[(seed >>> k) % arr.length];
  const c1 = d.primary;
  const c2 = d.accent;
  const c3 = d.accent2;
  const dark = d.style.dark;
  const brutal = d.style.card === 'brutal';
  const lineStyle = d.style.badge === 'outline' || d.style.decoration === 'grid' || d.style.decoration === 'blueprint';
  const base = Math.round(s * 0.62);
  const bx = Math.round((s - base) / 2) + pick([-1, 0, 1], 3) * Math.round(s * 0.06);
  const by = Math.round((s - base) / 2) + pick([-1, 0, 1], 5) * Math.round(s * 0.05);
  const abs = (x: number, y: number, w: number, h: number, inner: string, extra = '') =>
    `<div style="position:absolute;left:${Math.round(x)}px;top:${Math.round(y)}px;width:${Math.round(w)}px;height:${Math.round(h)}px;${extra}">${inner}</div>`;
  const svg = (w: number, h: number, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block">${body}</svg>`;

  // Grundform
  let shape: string;
  const fill = lineStyle ? 'transparent' : dark ? mix(d.bg, c1, 0.55) : d.style.id === 'pastel' || d.style.id === 'glass' ? tint(c1, 0.7) : c1;
  if (d.style.decoration === 'organic' || d.style.id === 'playful') {
    shape = abs(bx, by, base, base, svg(base, base, `<g fill="#${fill}">${blobPathFor(base, seed % 3)}</g>`));
  } else {
    const radius = d.style.badge === 'square' || d.style.id === 'swiss' ? 0 : brutal ? Math.round(base * 0.18) : lineStyle ? Math.round(base * 0.12) : pick([base / 2, Math.round(base * 0.28)], 7);
    const bg = d.style.badge === 'gradient' ? `linear-gradient(135deg,#${c1} 0%,#${c3} 100%)` : lineStyle ? 'transparent' : '#' + fill;
    const border = brutal ? 'border:3px solid #111418;box-shadow:10px 10px 0 #111418;' : lineStyle ? `border:1.5px solid ${rgba(dark ? c2 : c1, 0.7)};` : '';
    shape = abs(bx, by, base, base, '', `border-radius:${radius}px;background:${bg};box-sizing:border-box;${border}`);
  }
  // Icon auf der Grundform
  const iconCol = lineStyle ? (dark ? c2 : c1) : d.style.id === 'pastel' || d.style.id === 'glass' ? shade(c1, 0.35) : onColor(dark ? mix(d.bg, c1, 0.55) : c1);
  const iconSize = Math.round(base * 0.5);
  const iconEl = icon ? abs(bx + (base - iconSize) / 2, by + (base - iconSize) / 2, iconSize, iconSize, iconSvg(icon, iconSize, iconCol, lineStyle ? 'regular' : 'filled')) : '';

  // Akzente in den Ecken (Positionen je Signatur)
  const corners = [
    [s * 0.02, s * 0.04],
    [s * 0.74, s * 0.02],
    [s * 0.02, s * 0.72],
    [s * 0.76, s * 0.74],
  ];
  const rot = seed % 4;
  const at = (k: number) => corners[(k + rot) % 4];
  const accents: string[] = [];
  const ring = Math.round(s * 0.22);
  const [rx, ry] = at(0);
  accents.push(abs(rx, ry, ring, ring, svg(ring, ring, `<circle cx="${ring / 2}" cy="${ring / 2}" r="${ring / 2 - 4}" fill="none" stroke="#${c2}" stroke-width="${brutal ? 6 : 4}"/>`)));
  const dotsN = 4;
  const gap = Math.round(s * 0.05);
  const [dx, dy] = at(1);
  let dots = '';
  for (let r = 0; r < dotsN; r++) for (let c = 0; c < dotsN; c++) dots += `<circle cx="${c * gap + 4}" cy="${r * gap + 4}" r="3.2" fill="#${dark ? tint(c3, 0.2) : c3}"/>`;
  accents.push(abs(dx, dy, gap * (dotsN - 1) + 8, gap * (dotsN - 1) + 8, svg(gap * (dotsN - 1) + 8, gap * (dotsN - 1) + 8, dots)));
  const small = Math.round(s * 0.13);
  const [sx, sy] = at(2);
  accents.push(abs(sx + s * 0.04, sy + s * 0.04, small, small, '', `border-radius:${small / 2}px;background:#${c3};${brutal ? 'border:2.5px solid #111418;box-sizing:border-box;' : ''}`));
  const [px, py] = at(3);
  const plus = Math.round(s * 0.1);
  accents.push(pick([
    abs(px, py, plus, plus, svg(plus, plus, `<path d="M${plus / 2} 3V${plus - 3}M3 ${plus / 2}H${plus - 3}" stroke="#${c2}" stroke-width="5" stroke-linecap="round"/>`)),
    abs(px - s * 0.06, py + s * 0.04, s * 0.26, s * 0.08, svg(Math.round(s * 0.26), Math.round(s * 0.08), `<path d="M4 ${s * 0.04}C${s * 0.05} 4 ${s * 0.08} 4 ${s * 0.13} ${s * 0.04}S${s * 0.21} ${s * 0.076} ${s * 0.25} ${s * 0.04}" fill="none" stroke="#${c2}" stroke-width="5" stroke-linecap="round"/>`)),
  ], 11));

  const pos = o.x != null ? `position:absolute;left:${o.x}px;top:${o.y ?? 0}px;` : 'position:relative;';
  return `<div data-deco="1" style="${pos}width:${s}px;height:${s}px;flex:none">${accents.join('')}${shape}${iconEl}</div>`;
}

function blobPathFor(s: number, v: number) {
  const k = s / 200;
  const paths = [
    'M163,34C189,59,203,100,193,138C183,176,149,203,108,203C67,203,24,183,9,146C-6,109,5,62,34,35C63,8,137,9,163,34Z',
    'M170,46C196,78,196,124,176,160C156,196,116,212,78,202C40,192,6,158,3,117C0,76,28,29,67,12C106,-5,144,14,170,46Z',
    'M181,72C198,112,186,166,150,190C114,214,62,208,31,178C0,148,-8,96,15,58C38,20,86,-3,125,6C164,15,164,32,181,72Z',
  ];
  return `<path transform="scale(${k})" d="${paths[v % 3]}"/>`;
}
