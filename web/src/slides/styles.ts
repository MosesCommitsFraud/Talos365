// Design-Stile („Art Directions“): Ein Stil legt nicht nur Farben fest, sondern die
// ganze Gestaltung – Schriften und Größen, Kartenbehandlung, Rundungen, Schatten,
// Icon-Behandlung, Hintergrund-Dekoration und Hell/Dunkel. Das Modell wählt Stil + Palette.

export type CardKind = 'glass' | 'elevated' | 'outline' | 'tint' | 'plain' | 'frost' | 'brutal' | 'line';
export type Decoration =
  | 'aurora' | 'grid' | 'blocks' | 'rules' | 'orbs' | 'none'
  | 'mesh' | 'hairline' | 'gradient' | 'confetti' | 'organic' | 'blueprint' | 'spot' | 'bubbles';
/** Icon-Behandlung */
export type BadgeKind = 'glow' | 'bare' | 'square' | 'soft' | 'round' | 'outline' | 'brutal' | 'gradient';

export interface StyleDef {
  id: string;
  name: string;
  mood: string;
  dark: boolean;
  /** Schriften – nur Windows-Standardschriften, damit Browser-Messung und PowerPoint übereinstimmen */
  display: string;
  heading: string;
  body: string;
  light: string;
  label: string;
  card: CardKind;
  radius: number;
  decoration: Decoration;
  badge: BadgeKind;
  /** Nummern als große Ziffern (type) oder als Plakette (chip) */
  numbers: 'type' | 'chip';
  /** Größe der Folientitel in px (1280er Raster) */
  titleSize: number;
  /** Laufweite der großen Schrift (px pro 100 px Schriftgröße, negativ = enger) */
  tracking: number;
  kickerUpper: boolean;
  defaultPalette: string;
}

const S = (s: StyleDef) => s;

export const STYLES: Record<string, StyleDef> = {
  aurora: S({
    id: 'aurora', name: 'Dark Aurora', mood: 'Innovation, KI, Tech, Keynote, Strategie – dunkel mit leuchtenden Verläufen und Glas-Karten',
    dark: true, display: 'Segoe UI Black', heading: 'Segoe UI Semibold', body: 'Segoe UI', light: 'Segoe UI Semilight', label: 'Segoe UI Semibold',
    card: 'glass', radius: 24, decoration: 'aurora', badge: 'glow', numbers: 'chip', titleSize: 52, tracking: -2, kickerUpper: true, defaultPalette: 'violet',
  }),
  keynote: S({
    id: 'keynote', name: 'Keynote Black', mood: 'Produktvorstellung, Vision, große Bühne – tiefschwarz, riesige weiße Schrift, ein leuchtender Akzent, sehr reduziert',
    dark: true, display: 'Segoe UI Semibold', heading: 'Segoe UI Semibold', body: 'Segoe UI', light: 'Segoe UI Light', label: 'Segoe UI Semibold',
    card: 'tint', radius: 28, decoration: 'spot', badge: 'glow', numbers: 'type', titleSize: 56, tracking: -3, kickerUpper: false, defaultPalette: 'electric',
  }),
  bento: S({
    id: 'bento', name: 'Bento', mood: 'Produkt, Überblick, Ergebnisse, Marketing – Kacheln wie in Apple-Keynotes',
    dark: false, display: 'Segoe UI Black', heading: 'Segoe UI Semibold', body: 'Segoe UI', light: 'Segoe UI Semilight', label: 'Segoe UI Semibold',
    card: 'elevated', radius: 30, decoration: 'none', badge: 'soft', numbers: 'chip', titleSize: 50, tracking: -2, kickerUpper: true, defaultPalette: 'coral',
  }),
  glass: S({
    id: 'glass', name: 'Frosted Glass', mood: 'Digitalisierung, UX, Software, Zukunftsthemen – helle Pastell-Farbwolken hinter milchigen Glaskarten',
    dark: false, display: 'Segoe UI Semibold', heading: 'Segoe UI Semibold', body: 'Segoe UI', light: 'Segoe UI Semilight', label: 'Segoe UI Semibold',
    card: 'frost', radius: 28, decoration: 'mesh', badge: 'soft', numbers: 'chip', titleSize: 50, tracking: -2, kickerUpper: true, defaultPalette: 'lavender',
  }),
  gradient: S({
    id: 'gradient', name: 'Vivid Gradient', mood: 'Marketing, Launch, Vertrieb, Start-up-Pitch – kräftige Farbverläufe auf den Heldenfolien, klare weiße Inhaltsfolien',
    dark: false, display: 'Segoe UI Black', heading: 'Segoe UI Semibold', body: 'Segoe UI', light: 'Segoe UI Semilight', label: 'Segoe UI Semibold',
    card: 'elevated', radius: 22, decoration: 'gradient', badge: 'gradient', numbers: 'chip', titleSize: 50, tracking: -2, kickerUpper: true, defaultPalette: 'sunset',
  }),
  swiss: S({
    id: 'swiss', name: 'Swiss Bold', mood: 'Zahlen, Fakten, klare Botschaften – riesige Typografie, viel Weißraum, ein starker Akzent',
    dark: false, display: 'Segoe UI Black', heading: 'Segoe UI Semibold', body: 'Segoe UI', light: 'Segoe UI Semilight', label: 'Segoe UI Semibold',
    card: 'plain', radius: 0, decoration: 'rules', badge: 'bare', numbers: 'type', titleSize: 56, tracking: -3, kickerUpper: true, defaultPalette: 'signal',
  }),
  mono: S({
    id: 'mono', name: 'Minimal Mono', mood: 'Tech, Produkt, Entwickler, Beratung – Schwarz-Weiß wie Linear/Vercel, feine Linien, Monospace-Details, ein Akzent',
    dark: false, display: 'Segoe UI Semibold', heading: 'Segoe UI Semibold', body: 'Segoe UI', light: 'Segoe UI Semilight', label: 'Consolas',
    card: 'line', radius: 12, decoration: 'none', badge: 'outline', numbers: 'type', titleSize: 50, tracking: -3, kickerUpper: false, defaultPalette: 'ink',
  }),
  editorial: S({
    id: 'editorial', name: 'Editorial', mood: 'Strategie, Kultur, Berichte, Premium – Serifen-Überschriften wie ein Magazin',
    dark: false, display: 'Georgia', heading: 'Georgia', body: 'Segoe UI', light: 'Segoe UI Semilight', label: 'Segoe UI Semibold',
    card: 'outline', radius: 6, decoration: 'rules', badge: 'bare', numbers: 'type', titleSize: 48, tracking: -1, kickerUpper: true, defaultPalette: 'terracotta',
  }),
  noir: S({
    id: 'noir', name: 'Luxury Noir', mood: 'Premium, Finanzen, Vorstand, Immobilien, Gala – schwarz mit Gold, Serifen, feine Linien',
    dark: true, display: 'Georgia', heading: 'Georgia', body: 'Segoe UI', light: 'Segoe UI Light', label: 'Segoe UI Semibold',
    card: 'line', radius: 0, decoration: 'hairline', badge: 'outline', numbers: 'type', titleSize: 48, tracking: -1, kickerUpper: true, defaultPalette: 'gold',
  }),
  corporate: S({
    id: 'corporate', name: 'Corporate Clean', mood: 'Vorstand, Kunden, Finanzen – seriös, ruhig, hochwertig',
    dark: false, display: 'Segoe UI Semibold', heading: 'Segoe UI Semibold', body: 'Segoe UI', light: 'Segoe UI Semilight', label: 'Segoe UI Semibold',
    card: 'tint', radius: 16, decoration: 'orbs', badge: 'round', numbers: 'chip', titleSize: 44, tracking: -1, kickerUpper: true, defaultPalette: 'midnight',
  }),
  blocks: S({
    id: 'blocks', name: 'Color Block', mood: 'Kampagnen, Workshops, Kreatives, Kickoff – kräftige Farbflächen, geometrisch',
    dark: false, display: 'Century Gothic', heading: 'Century Gothic', body: 'Segoe UI', light: 'Segoe UI Semilight', label: 'Segoe UI Semibold',
    card: 'tint', radius: 0, decoration: 'blocks', badge: 'square', numbers: 'chip', titleSize: 50, tracking: -1, kickerUpper: true, defaultPalette: 'amber',
  }),
  neo: S({
    id: 'neo', name: 'Neo Brutal', mood: 'Kreativ, Start-up, junge Zielgruppe, Workshops, Innovation – dicke schwarze Konturen, harte Schatten, knallige Farben',
    dark: false, display: 'Segoe UI Black', heading: 'Segoe UI Black', body: 'Segoe UI', light: 'Segoe UI', label: 'Segoe UI Black',
    card: 'brutal', radius: 14, decoration: 'none', badge: 'brutal', numbers: 'chip', titleSize: 52, tracking: -2, kickerUpper: true, defaultPalette: 'retro',
  }),
  playful: S({
    id: 'playful', name: 'Playful Memphis', mood: 'Schule, Onboarding, Events, Kinder, Social Media – bunte geometrische Formen, rund und fröhlich',
    dark: false, display: 'Century Gothic', heading: 'Century Gothic', body: 'Segoe UI', light: 'Segoe UI Semilight', label: 'Segoe UI Semibold',
    card: 'tint', radius: 22, decoration: 'confetti', badge: 'round', numbers: 'chip', titleSize: 48, tracking: -1, kickerUpper: true, defaultPalette: 'candy',
  }),
  pastel: S({
    id: 'pastel', name: 'Soft Pastel', mood: 'HR, Gesundheit, Bildung, Soziales, Kultur – sanfte Pastellflächen, weiche Rundungen, freundlich',
    dark: false, display: 'Century Gothic', heading: 'Segoe UI Semibold', body: 'Segoe UI', light: 'Segoe UI Semilight', label: 'Segoe UI Semibold',
    card: 'tint', radius: 34, decoration: 'bubbles', badge: 'soft', numbers: 'chip', titleSize: 48, tracking: -1, kickerUpper: true, defaultPalette: 'rose',
  }),
  organic: S({
    id: 'organic', name: 'Organic', mood: 'Nachhaltigkeit, Natur, Lebensmittel, Wellness – warme Sandtöne, organische Formen, Serifen',
    dark: false, display: 'Georgia', heading: 'Segoe UI Semibold', body: 'Segoe UI', light: 'Segoe UI Semilight', label: 'Segoe UI Semibold',
    card: 'tint', radius: 26, decoration: 'organic', badge: 'round', numbers: 'chip', titleSize: 50, tracking: -1, kickerUpper: true, defaultPalette: 'forest',
  }),
  tech: S({
    id: 'tech', name: 'Tech Grid', mood: 'IT, Daten, Engineering, Architektur – dunkles Raster, Neon-Akzent, technische Schrift',
    dark: true, display: 'Bahnschrift SemiBold', heading: 'Bahnschrift SemiBold', body: 'Segoe UI', light: 'Segoe UI Semilight', label: 'Bahnschrift',
    card: 'outline', radius: 10, decoration: 'grid', badge: 'glow', numbers: 'type', titleSize: 50, tracking: -1, kickerUpper: true, defaultPalette: 'neon',
  }),
  blueprint: S({
    id: 'blueprint', name: 'Blueprint', mood: 'Planung, Technik, Bau, Produktion, Prozesse – Bauplan-Blau mit feinem Raster und Messmarken',
    dark: true, display: 'Bahnschrift SemiBold', heading: 'Bahnschrift SemiBold', body: 'Segoe UI', light: 'Segoe UI Semilight', label: 'Consolas',
    card: 'line', radius: 4, decoration: 'blueprint', badge: 'outline', numbers: 'type', titleSize: 50, tracking: -1, kickerUpper: true, defaultPalette: 'blueprint',
  }),
};

interface PaletteDef {
  name: string;
  primary: string;
  accent: string;
  accent2: string;
}

export const PALETTES: Record<string, PaletteDef> = {
  violet: { name: 'Violett/Türkis', primary: '6D4AFF', accent: '12D6C0', accent2: 'FF5C8A' },
  neon: { name: 'Cyan/Lime', primary: '22D3EE', accent: 'A3E635', accent2: '818CF8' },
  electric: { name: 'Elektrisch Blau', primary: '3B82F6', accent: '22D3EE', accent2: 'F43F5E' },
  coral: { name: 'Koralle/Blau', primary: 'FF5A36', accent: '2B59FF', accent2: 'FFC53D' },
  sunset: { name: 'Sonnenuntergang', primary: 'F4511E', accent: 'D6246E', accent2: '7C3AED' },
  lavender: { name: 'Lavendel', primary: '7C3AED', accent: 'EC4899', accent2: '22D3EE' },
  candy: { name: 'Bonbon', primary: 'EC4899', accent: '6366F1', accent2: 'FACC15' },
  rose: { name: 'Rosé/Salbei', primary: 'D9467A', accent: '5B8A72', accent2: 'F2A541' },
  retro: { name: 'Retro', primary: 'FF5A36', accent: '2EC4B6', accent2: 'FFCA3A' },
  signal: { name: 'Signalrot', primary: 'FF3B1F', accent: '111111', accent2: 'FFB300' },
  terracotta: { name: 'Terrakotta/Salbei', primary: 'B8553A', accent: '5E7D6A', accent2: 'D9A441' },
  sand: { name: 'Sand/Oliv', primary: 'A0522D', accent: '6B7F3A', accent2: 'D4A373' },
  gold: { name: 'Schwarz/Gold', primary: 'C9A96E', accent: 'E6D3A8', accent2: '8C6A3F' },
  midnight: { name: 'Mitternachtsblau', primary: '1E3A8A', accent: '0EA5E9', accent2: 'F59E0B' },
  blueprint: { name: 'Bauplan', primary: '1D4ED8', accent: 'FACC15', accent2: '38BDF8' },
  amber: { name: 'Orange/Petrol', primary: 'F97316', accent: '0F766E', accent2: 'FACC15' },
  forest: { name: 'Waldgrün', primary: '2F6B3F', accent: 'C0843D', accent2: '8BAA5B' },
  ocean: { name: 'Ozean', primary: '0369A1', accent: '06B6D4', accent2: 'F59E0B' },
  berry: { name: 'Beere', primary: 'A21CAF', accent: 'F43F5E', accent2: 'FB923C' },
  teal: { name: 'Petrol/Mint', primary: '0F766E', accent: '2DD4BF', accent2: 'F59E0B' },
  ink: { name: 'Tinte/Blau', primary: '111111', accent: '2563EB', accent2: 'F43F5E' },
  mono: { name: 'Schwarz/Weiß', primary: '18181B', accent: '71717A', accent2: 'A1A1AA' },
};

export function hexClean(c: string | undefined, fallback: string): string {
  const v = (c ?? '').replace('#', '').trim().toUpperCase();
  return /^[0-9A-F]{6}$/.test(v) ? v : fallback;
}
function rgb(hex: string): [number, number, number] {
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}
function toHex(v: number[]): string {
  return v.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('').toUpperCase();
}
export const tint = (hex: string, a: number) => toHex(rgb(hex).map((v) => v + (255 - v) * a));
export const shade = (hex: string, a: number) => toHex(rgb(hex).map((v) => v * (1 - a)));
export const mix = (a: string, b: string, t: number) => {
  const x = rgb(a);
  const y = rgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
};
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const onColor = (hex: string) => (luminance(hex) > 0.45 ? '111418' : 'FFFFFF');
/** WCAG-Kontrast zweier Hex-Farben */
export const contrastHex = (a: string, b: string) => {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** Zweite Farbe eines Verlaufs hinter Text in onColor(primary): accent2 nur, wenn der Text
 *  darauf lesbar bleibt – sonst eine dunklere Stufe der Hauptfarbe. */
export function gradientEnd(d: { primary: string; accent2: string; onPrimary: string }, preferAccent = true): string {
  if (preferAccent && contrastHex(d.onPrimary, d.accent2) >= 4.5) return d.accent2;
  return d.onPrimary === 'FFFFFF' ? shade(d.primary, 0.3) : tint(d.primary, 0.25);
}
export const rgba = (hex: string, a: number) => {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

/** Aufgelöstes Design für eine Präsentation. */
export interface Design {
  style: StyleDef;
  paletteName: string;
  bg: string;
  bgAlt: string;
  surface: string;
  text: string;
  muted: string;
  faint: string;
  primary: string;
  accent: string;
  accent2: string;
  onPrimary: string;
  chart: string[];
  transition: 'morph' | 'fade' | 'none';
  /** Schriften der Firmenvorlage fehlen evtl. im Browser → mehr Reserve beim Einpassen */
  fontSlack: number;
  /** Design-Signatur der Präsentation (wählt Layout-Varianten und Deko-Positionen) */
  seed: number;
}

export interface ThemeRequest {
  style?: string;
  palette?: string;
  primary?: string;
  accent?: string;
  transition?: 'morph' | 'fade' | 'none';
  /** Design-Signatur (wird beim ersten Erstellen zufällig vergeben und gemerkt) */
  seed?: number;
}

export interface PresentationDesign {
  primary: string;
  accent: string;
  accent2: string;
  dark: string;
  headFont?: string;
  bodyFont?: string;
}

/** Passende Paletten je Stil – ohne ausdrückliche Palette wählt die Design-Signatur eine davon */
const STYLE_PALETTES: Record<string, string[]> = {
  aurora: ['violet', 'electric', 'berry', 'teal', 'sunset'],
  keynote: ['electric', 'violet', 'sunset', 'teal'],
  bento: ['coral', 'electric', 'teal', 'berry', 'amber'],
  glass: ['lavender', 'electric', 'candy', 'teal'],
  gradient: ['sunset', 'lavender', 'electric', 'berry', 'candy'],
  swiss: ['signal', 'electric', 'teal', 'amber'],
  mono: ['ink', 'mono', 'signal'],
  editorial: ['terracotta', 'sand', 'midnight', 'forest'],
  noir: ['gold', 'terracotta', 'sand'],
  corporate: ['midnight', 'ocean', 'teal', 'forest', 'berry'],
  blocks: ['amber', 'coral', 'retro', 'teal', 'electric'],
  neo: ['retro', 'candy', 'coral', 'electric', 'amber'],
  playful: ['candy', 'retro', 'lavender', 'amber'],
  pastel: ['rose', 'lavender', 'teal', 'candy'],
  organic: ['forest', 'sand', 'terracotta', 'teal'],
  tech: ['neon', 'electric', 'violet', 'teal'],
  blueprint: ['blueprint', 'ocean', 'midnight'],
};

/** Hintergründe der dunklen Stile */
const DARK_BG: Record<string, (p: string) => string> = {
  tech: (p) => mix('0B1220', p, 0.06),
  keynote: () => '000000',
  noir: () => '0C0B0A',
  blueprint: (p) => mix('0A1E4A', p, 0.18),
};
/** Hintergründe der hellen Stile (Standard: Weiß) */
const LIGHT_BG: Record<string, (p: string) => string> = {
  bento: () => 'F2F1EE',
  editorial: () => 'FAF9F6',
  glass: (p) => mix('F4F5FA', p, 0.03),
  neo: () => 'FFF4DE',
  pastel: (p) => mix('FCF8F5', p, 0.04),
  playful: () => 'FFFCF5',
  organic: () => 'F3EEE3',
};

export function resolveDesign(req: ThemeRequest = {}, auto?: PresentationDesign | null): Design {
  const useAuto = (req.style === 'auto' || req.palette === 'auto') && !!auto;
  const style = { ...(STYLES[req.style ?? ''] ?? (useAuto ? STYLES.corporate : STYLES.aurora)) };
  let fontSlack = 0;
  if (useAuto && auto) {
    if (auto.headFont) {
      style.display = auto.headFont;
      style.heading = auto.headFont;
    }
    if (auto.bodyFont) {
      style.body = auto.bodyFont;
      style.light = auto.bodyFont;
      style.label = auto.bodyFont;
    }
    fontSlack = 0.08;
  }
  const choices = STYLE_PALETTES[style.id] ?? [style.defaultPalette];
  const pal = PALETTES[req.palette ?? ''] ?? PALETTES[req.seed ? choices[Number(req.seed) % choices.length] : style.defaultPalette];
  const primary = hexClean(req.primary, useAuto && auto ? auto.primary : pal.primary);
  const accent = hexClean(req.accent, useAuto && auto ? auto.accent : pal.accent);
  const accent2 = useAuto && auto ? auto.accent2 : pal.accent2;
  const base = { style, paletteName: useAuto ? 'Präsentation' : pal.name, primary, accent, accent2, onPrimary: onColor(primary), transition: req.transition ?? 'none', fontSlack, seed: Number(req.seed) || 0 };

  if (style.dark) {
    const bg = (DARK_BG[style.id] ?? ((p: string) => mix('07080F', p, 0.1)))(primary);
    const noir = style.id === 'noir';
    return {
      ...base,
      bg,
      bgAlt: mix(bg, 'FFFFFF', 0.04),
      surface: style.id === 'keynote' ? '1C1C1E' : mix(bg, 'FFFFFF', 0.07),
      text: noir ? 'F4EFE6' : 'FFFFFF',
      muted: noir ? 'B7AE9C' : style.id === 'blueprint' ? 'BCCBEA' : 'B4B8CC',
      faint: noir ? '6F6757' : '6E7390',
      chart: [primary, accent, accent2, tint(primary, 0.45), tint(accent, 0.45)],
    };
  }
  const bg = (LIGHT_BG[style.id] ?? (() => 'FFFFFF'))(primary);
  const surface =
    style.id === 'bento' || style.id === 'neo' || style.id === 'glass' ? 'FFFFFF'
      : style.id === 'pastel' ? tint(primary, 0.86)
        : style.id === 'organic' ? mix(bg, primary, 0.12)
          : style.id === 'playful' ? tint(accent2, 0.78)
            : tint(primary, 0.93);
  return {
    ...base,
    bg,
    bgAlt: style.id === 'bento' ? 'FFFFFF' : tint(primary, 0.95),
    surface,
    text: style.id === 'neo' ? '111418' : '111418',
    muted: '5B616E',
    faint: '9AA0AB',
    chart: [primary, accent, accent2, tint(primary, 0.5), shade(accent, 0.25)],
  };
}

export function styleCatalog(): string {
  return Object.values(STYLES)
    .map((s) => `${s.id} (${s.name}: ${s.mood})`)
    .join('; ');
}
export function paletteCatalog(): string {
  return Object.entries(PALETTES)
    .map(([id, p]) => `${id} (${p.name})`)
    .join(', ');
}
