// Design-Werkzeuge für PowerPoint + der „Design-Skill“ (Gestaltungsregeln im Prompt).
import type { HostTool } from '@/lib/types';
import { createSlides, deckTheme, designFor, designedSlides, replaceSlide, slideDesign, slideImages } from './deck';
import { measureDeck } from './render';
import { iconNames, searchIcons } from './icons';
import { contactSheet, creditOf, searchImages } from './images';
import { LAYOUTS } from './layouts';
import { referenceTools } from './reference';
import { STYLES, paletteCatalog, styleCatalog, type ThemeRequest } from './styles';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const PowerPoint: any;

// ── Qualitätssicherung über mehrere Runden ─────────────────────────────────
// Jede neu erstellte oder geänderte Folie muss danach per review_slides geprüft
// werden. Beendet das Modell seinen Auftrag vorher, schickt der Agent es zurück.

const pendingReview = new Set<number>();
const lastWarnings = new Map<number, string[]>();
let reviewRounds = 0;
let nudges = 0;
/** Wurde in diesem Auftrag etwas geändert – und danach die Einheitlichkeit geprüft? */
let changedThisTurn = false;
let deckChecked = false;

function markChanged(numbers: number[], warnings: string[]) {
  changedThisTurn = true;
  deckChecked = false;
  for (const n of numbers) {
    pendingReview.add(n);
    lastWarnings.set(n, warnings.filter((w) => w.startsWith(`Folie ${n}:`)));
  }
}

/** Neuer Auftrag: Zähler zurücksetzen */
export function designTurnStart() {
  changedThisTurn = false;
  deckChecked = false;
  pendingReview.clear();
  reviewRounds = 0;
  nudges = 0;
}

/** Vor dem Abschluss: Sind alle geänderten Folien geprüft? */
export function designFinishCheck(): string | null {
  if (nudges >= 3) return null;
  if (!pendingReview.size) {
    if (!changedThisTurn || deckChecked) return null;
    nudges++;
    return 'Konsistenzprüfung fehlt noch: Rufe jetzt check_deck auf (prüft Kontrast, Titelgrößen, Überzeilen, Satzzeichen und Layout-Mix über alle Folien) und behebe die Hinweise mit update_slide. Erst danach abschließen.';
  }
  nudges++;
  const list = [...pendingReview].sort((a, b) => a - b);
  return `Qualitätsprüfung fehlt noch: Die Folien ${list.join(', ')} wurden erstellt oder geändert, aber danach nicht geprüft. Rufe jetzt review_slides für diese Folien auf, bewerte sie streng und verbessere alles unter 8/10 mit update_slide. Erst danach abschließen.`;
}

const REVIEW_PROMPT = `Selbstcheck – Runde {round}. Hier sind die gerenderten Folien. Bewerte JEDE Folie streng wie ein Art Director (Note 1–10) nach:
1. Wirkung & Modernität (wirkt sie hochwertig, mutig, zeitgemäß – oder generisch?)
2. Hierarchie (eine klare Hauptaussage, Blickführung)
3. Lesbarkeit & Kontrast (nichts abgeschnitten, zu klein, überlappend, Text auf unruhigem Bild)
4. Weißraum & Balance (keine leeren Löcher, nichts gequetscht)
5. Bild & Visualisierung (passt das Foto/Icon/Diagramm zur Aussage?)
6. Abwechslung zum Rest des Decks
Schreibe pro Folie kurz: „Folie N: Note X – Mangel – Maßnahme“. Jede Folie unter 8 verbesserst du jetzt mit update_slide (z. B. anderes Layout, kürzerer Text, passenderes Bild, Zahl als big_number/stat_row, Hervorhebung). Danach prüfst du die geänderten Folien erneut. Sind alle Folien ≥ 8, fasse kurz zusammen.`;

// ── Schemas ────────────────────────────────────────────────────────────────

const themeSchema = {
  type: 'object',
  description: 'Design der Präsentation. Einmal pro Präsentation festlegen, danach weglassen (wird gemerkt).',
  properties: {
    style: { type: 'string', description: `Design-Stil passend zu Thema und Publikum: ${styleCatalog()}; oder "auto" = Farben/Schriften der geöffneten Präsentation (Firmenvorlage).` },
    palette: { type: 'string', description: `Optional andere Farbpalette: ${paletteCatalog()}` },
    primary: { type: 'string', description: 'Optional eigene Hauptfarbe (Hex), z. B. Firmenfarbe' },
    accent: { type: 'string', description: 'Optional eigene Akzentfarbe (Hex)' },
    transition: { type: 'string', enum: ['morph', 'fade', 'none'], description: 'Übergang für ALLE Folien – normalerweise weglassen (Standard: keiner). Einzelne Übergänge besser pro Folie setzen.' },
  },
};

const imageProp = { type: 'string', description: 'Foto: ID aus search_images (z. B. "img3") oder direkte Bild-URL' };

const itemSchema = {
  type: 'object',
  properties: {
    icon: { type: 'string', description: 'Icon-Begriff auf Englisch, z. B. "people team", "money", "rocket", "shield lock", "target"' },
    title: { type: 'string', description: 'Kurz: max. 4 Wörter' },
    text: { type: 'string', description: 'Kurz: max. ~20 Wörter (bei options/swot: Punkte mit ; trennen)' },
    value: { type: 'string', description: 'Kennzahl, z. B. "+12 %", "240", "85.000 €"' },
    label: { type: 'string', description: 'Beschriftung der Kennzahl / Rolle einer Person / Stufe' },
    date: { type: 'string', description: 'Zeitpunkt (timeline, roadmap), z. B. "Q1 2026"' },
    progress: { type: 'number', description: 'Fortschritt 0–100 (progress)' },
    featured: { type: 'boolean', description: 'Hervorgehoben (options, matrix)' },
    done: { type: 'boolean', description: 'Erledigt (checklist)' },
    image: imageProp,
    image_focus: { type: 'string', description: 'Bildausschnitt, z. B. "50% 30%" (Gesicht oben halten)' },
  },
};

const sideSchema = { type: 'object', properties: { title: { type: 'string' }, items: { type: 'array', items: { type: 'string' } } } };

const slideSchema = {
  type: 'object',
  properties: {
    layout: { type: 'string', enum: [...LAYOUTS] },
    title: { type: 'string', description: 'Aussagekräftige Überschrift (eine Botschaft, kein Stichwort)' },
    subtitle: { type: 'string' },
    kicker: { type: 'string', description: 'Kleine Überzeile, z. B. Kapitel, Datum oder Anlass' },
    text: { type: 'string', description: 'Fließtext (split, image_split, big_number, giant, cycle-Mitte)' },
    icon: { type: 'string', description: 'Leit-Icon (title, statement, bullets)' },
    number: { type: 'string', description: 'Kapitelnummer (section), z. B. "01"' },
    value: { type: 'string', description: 'Die große Zahl / das große Wort (big_number, image_stat, giant)' },
    label: { type: 'string', description: 'Beschriftung der großen Zahl (big_number, image_stat)' },
    items: { type: 'array', items: itemSchema },
    bullets: { type: 'array', items: { type: 'string' }, description: 'Nur für bullets/split/image_split' },
    left: sideSchema,
    right: sideSchema,
    verdict: { type: 'string', description: 'Fazit unter einem Vergleich' },
    chart: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['column', 'bar', 'line', 'area', 'pie', 'doughnut', 'stacked_column', 'stacked_bar'] },
        categories: { type: 'array', items: { type: 'string' } },
        series: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' }, values: { type: 'array', items: { type: 'number' } } } },
        },
        unit: { type: 'string', description: 'Einheit für Beschriftungen, z. B. " %" oder " Mio. €"' },
        highlight: { type: 'string', description: 'Eine Kategorie hervorheben (Balken), die übrigen dezent' },
      },
    },
    takeaway: { type: 'string', description: 'Kernaussage zu Diagramm/Kennzahlen' },
    highlight: { type: 'object', properties: { value: { type: 'string' }, label: { type: 'string' } } },
    quote: { type: 'string' },
    author: { type: 'string' },
    role: { type: 'string' },
    columns: { type: 'array', items: { type: 'string' } },
    rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
    x_label: { type: 'string', description: 'Achse rechts (matrix)' },
    y_label: { type: 'string', description: 'Achse oben (matrix)' },
    image: imageProp,
    image_focus: { type: 'string', description: 'Bildausschnitt, z. B. "50% 30%"' },
    image_side: { type: 'string', enum: ['left', 'right'], description: 'Seite des Fotos (image_split, title mit Bild)' },
    image_scrim: { type: 'string', enum: ['bottom', 'left', 'full'], description: 'Abdunklung für Text auf dem Foto (image_hero)' },
    notes: { type: 'string', description: 'Sprechernotizen (Vortragstext gehört HIERHIN, nicht auf die Folie)' },
    variant: { type: 'string', description: 'Gestaltungsvariante des Layouts (siehe Design-Skill), sonst automatisch' },
    transition: { type: 'string', enum: ['morph', 'fade', 'none'], description: 'Übergang zu DIESER Folie – nur gezielt (höchstens 2–3 pro Präsentation), sonst weglassen' },
  },
  required: ['layout'],
};

async function themeOr(req: ThemeRequest | undefined): Promise<ThemeRequest> {
  const saved = await deckTheme();
  const theme = req && Object.keys(req).length ? { ...req } : saved ?? { style: 'aurora' };
  // Design-Signatur: bestehende behalten, sonst neu würfeln
  if (!theme.seed) theme.seed = saved?.seed ?? 1 + Math.floor(Math.random() * 100000);
  return theme;
}

async function saveTheme(theme: ThemeRequest) {
  try {
    await PowerPoint.run(async (ctx: any) => {
      ctx.presentation.tags.add('TALOS_THEME', JSON.stringify(theme));
      await ctx.sync();
    });
  } catch {
    /* ältere PowerPoint-Version */
  }
}

// Zuletzt verwendete Stile (pro Rechner) – für Abwechslung zwischen Präsentationen
const RECENT_KEY = 'talos365.recentStyles';
function recentStyles(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}
function rememberStyle(style: string | undefined) {
  if (!style || style === 'auto') return;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([style, ...recentStyles().filter((s) => s !== style)].slice(0, 5)));
  } catch {
    /* egal */
  }
}

const HERO = new Set(['title', 'section', 'statement', 'big_number', 'quote', 'closing', 'image_hero', 'image_stat', 'image_quote', 'giant']);
const TEXTY = new Set(['bullets', 'agenda', 'checklist', 'faq']);

/** Prüft eine geplante Gliederung auf typische Schwächen generischer Decks. */
function critiquePlan(plan: { style?: string; slides?: Array<{ layout?: string; message?: string; image?: string | boolean }> }): string[] {
  const slides = plan.slides ?? [];
  const tips: string[] = [];
  if (plan.style && !STYLES[plan.style] && plan.style !== 'auto') tips.push(`Stil „${plan.style}“ gibt es nicht. Verfügbar: ${Object.keys(STYLES).join(', ')}.`);
  const recent = recentStyles().slice(0, 2);
  if (plan.style && recent.includes(plan.style)) {
    const others = Object.keys(STYLES).filter((s) => !recentStyles().includes(s)).slice(0, 6);
    tips.push(`Stil „${plan.style}“ wurde gerade erst verwendet – für Abwechslung einen anderen passenden Stil wählen (z. B. ${others.join(', ')}), außer der Nutzer wünscht ihn.`);
  }
  if (slides.length < 3) return tips;
  const layouts = slides.map((s) => s.layout ?? '');
  const unknown = layouts.filter((l) => l && !(LAYOUTS as readonly string[]).includes(l));
  if (unknown.length) tips.push(`Unbekannte Layouts: ${[...new Set(unknown)].join(', ')}.`);
  for (let i = 1; i < layouts.length; i++) if (layouts[i] === layouts[i - 1] && !HERO.has(layouts[i])) tips.push(`Folie ${i + 1}: gleiches Layout wie davor (${layouts[i]}).`);
  const hero = layouts.filter((l) => HERO.has(l)).length;
  if (slides.length >= 6 && hero < 2) tips.push('Zu wenige Rhythmus-Brecher: mindestens 2 Heldenfolien (statement, big_number, image_hero, giant, quote, section) einplanen.');
  const texty = layouts.filter((l) => TEXTY.has(l)).length;
  if (texty > Math.max(1, slides.length / 4)) tips.push(`${texty} textlastige Folien (bullets/agenda/checklist/faq) – mindestens die Hälfte davon visualisieren (cards, icon_grid, process, stat_row, image_split …).`);
  const distinct = new Set(layouts).size;
  if (slides.length >= 6 && distinct < Math.min(slides.length - 1, 6)) tips.push(`Nur ${distinct} verschiedene Layouts – mehr Vielfalt.`);
  const withImages = slides.filter((s) => s.image || String(s.layout).startsWith('image_')).length;
  if (slides.length >= 6 && withImages === 0) tips.push('Optional: Fotos sind möglich (search_images → image_hero, image_split …), falls sie zum Thema passen. Kein Muss.');
  if (withImages > slides.length * 0.6) tips.push('Sehr viele Fotoseiten – Fotos gezielt für Wirkung einsetzen, nicht überall.');
  const vague = slides.filter((s) => (s.message ?? '').split(/\s+/).length < 3).length;
  if (vague) tips.push(`${vague} Folie(n) ohne klare Botschaft – jede Folie braucht eine Kernaussage als ganzen Satz.`);
  return tips;
}

export const designTools: HostTool[] = [
  {
    name: 'plan_deck',
    description:
      'Schritt 1 bei jeder neuen Präsentation: Gliederung festlegen (Publikum, Ziel, Stil, pro Folie Layout + Kernaussage + ob ein Foto passt). Liefert eine kritische Prüfung der Gliederung (Abwechslung, Rhythmus, Visualisierung, Fotos), die du vor create_slides einarbeitest.',
    parameters: {
      type: 'object',
      properties: {
        audience: { type: 'string' },
        goal: { type: 'string', description: 'Was soll das Publikum danach denken/tun?' },
        style: { type: 'string', description: 'Geplanter Design-Stil' },
        palette: { type: 'string' },
        slides: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              layout: { type: 'string', enum: [...LAYOUTS] },
              message: { type: 'string', description: 'Kernaussage der Folie als ganzer Satz' },
              image: { type: 'string', description: 'Suchbegriff (englisch) für ein Foto, falls passend' },
            },
          },
        },
      },
      required: ['slides'],
    },
    run: async (a) => {
      const tips = critiquePlan(a as Parameters<typeof critiquePlan>[0]);
      return tips.length
        ? { bewertung: 'überarbeiten', hinweise: tips, naechster_schritt: 'Gliederung anpassen, dann Fotos suchen (search_images) und create_slides.' }
        : { bewertung: 'gut', naechster_schritt: 'Fotos für die markierten Folien mit search_images suchen, dann create_slides mit allen Folien.' };
    },
  },
  {
    name: 'search_images',
    description:
      'Sucht frei lizenzierte Fotos im Internet (kommerzielle Nutzung und Bearbeitung erlaubt; Bildnachweis wird automatisch gesetzt). Du bekommst einen Kontaktbogen zu sehen und wählst per ID (z. B. "img3"). Suchbegriffe auf ENGLISCH und konkret-bildhaft ("wind turbines at sunset", "team meeting modern office").',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Englischer, bildhafter Suchbegriff' },
        count: { type: 'integer', description: 'Anzahl Treffer (Standard 6, max. 9)' },
        orientation: { type: 'string', enum: ['wide', 'tall', 'square'], description: 'wide für Vollbild/Hälfte quer, tall für schmale Hochformat-Spalten' },
      },
      required: ['query'],
    },
    run: async (a) => {
      const hits = await searchImages(String(a.query ?? ''), Math.min(9, Math.max(1, Number(a.count) || 6)), a.orientation as 'wide' | 'tall' | 'square' | undefined);
      if (!hits.length) return { treffer: [], hinweis: 'Keine Fotos gefunden – anderen, allgemeineren englischen Begriff versuchen.' };
      const sheet = await contactSheet(hits);
      if (!sheet) return { treffer: [], hinweis: 'Die gefundenen Fotos lassen sich gerade nicht laden – anderen Begriff versuchen oder später erneut.' };
      return {
        treffer: sheet.hits.map((h) => ({ id: h.id, titel: h.title.slice(0, 80), groesse: h.width && h.height ? `${h.width}×${h.height}` : undefined, nachweis: creditOf(h) })),
        hinweis: 'Wähle nur Fotos, die wirklich zur Aussage passen, scharf und hochwertig wirken und keine Wasserzeichen/Texte zeigen. Sonst neu suchen.',
        __images: [{ label: `Bildsuche: ${a.query}`, url: sheet.url }],
        __imagePrompt: `Kontaktbogen für „${a.query}“: Die Fotos sind mit ihrer ID beschriftet. Wähle passende IDs (oder suche erneut) und verwende sie im Feld image.`,
      };
    },
  },
  {
    name: 'create_slides',
    description:
      'Erstellt professionell gestaltete Folien im gewählten Design-Stil (native PowerPoint-Formen, Office-Icons, Fotos, echte Diagramme, optional Übergänge). Standardweg für JEDE neue Folie. Mehrere Folien in einem Aufruf. Liefert die Foliennummern und einen automatischen Qualitätscheck.',
    parameters: {
      type: 'object',
      properties: {
        theme: themeSchema,
        slides: { type: 'array', items: slideSchema },
        after_slide: { type: 'integer', description: 'Einfügen nach dieser Foliennummer (Standard: ans Ende)' },
      },
      required: ['slides'],
    },
    run: async (a) => {
      const slides = Array.isArray(a.slides) ? a.slides : [];
      if (!slides.length) throw new Error('slides ist leer.');
      const theme = await themeOr(a.theme as ThemeRequest);
      const res = await createSlides(slides, theme, a.after_slide as number | undefined);
      rememberStyle(theme.style);
      markChanged(res.numbers, res.warnings);
      return {
        created_slides: res.numbers,
        theme,
        ...(res.warnings.length
          ? { quality_check: res.warnings, hinweis: 'Behebe die Punkte aus quality_check mit update_slide, dann review_slides.' }
          : { quality_check: 'ok', hinweis: 'Prüfe das Ergebnis jetzt mit review_slides (Pflicht).' }),
        ...(res.removedBlank ? { removed_blank_slides: res.removedBlank } : {}),
      };
    },
  },
  {
    name: 'review_slides',
    description:
      'Selbstcheck (Pflicht nach jeder Erstellung/Änderung): Rendert Folien als Bild und zeigt sie dir zur strengen Bewertung. Danach Folien unter 8/10 mit update_slide verbessern und erneut prüfen.',
    parameters: {
      type: 'object',
      properties: { slides: { type: 'array', items: { type: 'integer' }, description: 'Foliennummern (max. 8 pro Aufruf)' } },
      required: ['slides'],
    },
    run: async (a) => {
      const numbers = (Array.isArray(a.slides) ? a.slides : []).map(Number).filter(Boolean).slice(0, 8);
      if (!numbers.length) throw new Error('Keine Foliennummern angegeben.');
      const images = await slideImages(numbers, 960);
      reviewRounds++;
      for (const i of images) pendingReview.delete(i.number);
      const auto = images.flatMap((i) => lastWarnings.get(i.number) ?? []);
      return {
        rendered: images.map((i) => i.number),
        runde: reviewRounds,
        ...(auto.length ? { automatische_pruefung: auto } : {}),
        ...(pendingReview.size ? { noch_ungeprueft: [...pendingReview].sort((x, y) => x - y) } : {}),
        __images: images.map((i) => ({ label: `Folie ${i.number}`, url: i.url })),
        __imagePrompt: REVIEW_PROMPT.replace('{round}', String(reviewRounds)),
      };
    },
  },
  {
    name: 'check_deck',
    description:
      'Konsistenzprüfung über ALLE gestalteten Folien (Pflicht am Ende): Lesbarkeit/Kontrast, einheitliche Titelgrößen, Überzeilen, Satzzeichen, Titellängen, Layout-Wiederholungen, Rhythmus. Liefert Hinweise je Folie.',
    parameters: { type: 'object', properties: {} },
    run: async () => {
      const slides = await designedSlides();
      if (!slides.length) return { hinweis: 'Keine gestalteten Folien vorhanden.' };
      const design = await designFor(await themeOr(undefined));
      const warnings = await measureDeck(slides.map((s) => s.spec), design, slides.map((s) => s.number - 1));
      deckChecked = true;
      const list = warnings.map((w) => `Folie ${slides[w.index]?.number ?? w.index + 1}: ${w.message}`);
      return list.length
        ? { ergebnis: 'verbessern', gepruefte_folien: slides.length, hinweise: list, naechster_schritt: 'Punkte mit update_slide beheben, geänderte Folien mit review_slides prüfen, dann erneut check_deck.' }
        : { ergebnis: 'einheitlich', gepruefte_folien: slides.length, hinweis: 'Keine Auffälligkeiten – Farben lesbar, Titel einheitlich.' };
    },
  },
  {
    name: 'get_slide_design',
    description: 'Liefert die Spezifikation (Layout + Inhalt) einer von dir gestalteten Folie, um sie gezielt zu ändern.',
    parameters: { type: 'object', properties: { slide: { type: 'integer' } }, required: ['slide'] },
    run: async (a) => {
      const spec = await slideDesign(Number(a.slide));
      return spec ?? { hinweis: 'Diese Folie wurde nicht mit create_slides erstellt – ändere sie mit den einfachen Werkzeugen oder ersetze sie per update_slide mit vollständiger Spezifikation.' };
    },
  },
  {
    name: 'update_slide',
    description:
      'Ändert eine von dir gestaltete Folie und baut sie neu. In spec nur die Felder angeben, die sich ändern (z. B. {"items": [...]} oder {"layout": "bento"} oder {"image": "img4"}); alle anderen Felder bleiben erhalten. Listen (items, bullets …) immer vollständig angeben.',
    parameters: {
      type: 'object',
      properties: { slide: { type: 'integer' }, spec: { ...slideSchema, required: [] } },
      required: ['slide', 'spec'],
    },
    run: async (a) => {
      const theme = await themeOr(undefined);
      const n = Number(a.slide);
      const { warnings } = await replaceSlide(n, a.spec, theme);
      markChanged([n], warnings);
      return { updated_slide: n, quality_check: warnings.length ? warnings : 'ok', hinweis: 'Geänderte Folie mit review_slides erneut prüfen.' };
    },
  },
  {
    name: 'set_deck_theme',
    description: 'Wechselt Design-Stil/Farben und gestaltet alle von dir erstellten Folien damit neu.',
    parameters: { type: 'object', properties: { theme: themeSchema }, required: ['theme'] },
    run: async (a) => {
      const theme = await themeOr(a.theme as ThemeRequest);
      const slides = await designedSlides();
      // Von hinten nach vorn ersetzen, damit sich Nummern nicht verschieben
      for (const s of [...slides].reverse()) {
        const { warnings } = await replaceSlide(s.number, s.spec, theme);
        markChanged([s.number], warnings);
      }
      await saveTheme(theme);
      if (!slides.length) return { hinweis: 'Keine gestalteten Folien vorhanden – das Design gilt ab create_slides.' };
      return { restyled_slides: slides.map((s) => s.number), theme, hinweis: 'Alle Folien mit review_slides prüfen.' };
    },
  },
  {
    name: 'search_icons',
    description: 'Sucht Office-Icons (Microsoft Fluent) nach Begriff. Nur nötig, wenn du unsicher bist – Icon-Begriffe werden sonst automatisch aufgelöst.',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    run: async (a) => ({ icons: searchIcons(String(a.query ?? ''), await iconNames(), 15) }),
  },
  ...referenceTools,
];

/** Der Design-Skill: Gestaltungsregeln nach dem Vorbild von Claudes PowerPoint-Skill
 *  und aktuellen Trends, zugeschnitten auf die Layout-Engine. */
export const DESIGN_PROMPT = `Du arbeitest in PowerPoint und gestaltest Präsentationen auf dem Niveau einer Top-Design-Agentur – modern, mutig, kreativ, klar. Generische „Titel + Aufzählung“-Folien sind ein Fehler. Du arbeitest gründlich in mehreren Runden, bis jede Folie überzeugt.

## Werkzeuge
- Neue Folien IMMER mit create_slides (HTML-Design-Engine → native, bearbeitbare PowerPoint-Formen, Office-Icons, Fotos, echte Diagramme). Nie Folien aus einzelnen Textfeldern bauen.
- Fotos: search_images (englische, bildhafte Begriffe) → du siehst einen Kontaktbogen → ID ins Feld image. Keine KI-generierten Bilder.
- Bestehende Folien lesen: get_presentation_overview. Eigene Folien ändern: get_slide_design → update_slide.
- Firmenvorlage mit guten Beispielfolien, deren Design exakt eingehalten werden soll? → analyze_template, dann clone_slide. Sonst create_slides mit style "auto" (Farben/Schriften der Vorlage).
- Einfache Werkzeuge (set_shape_text …) nur für kleine Korrekturen an vorhandenen, nicht von dir erstellten Folien.
- Hat der Nutzer Folien oder Elemente markiert (steht in seiner Nachricht), beziehe dich genau darauf.

## Ablauf bei neuen Präsentationen (alle Schritte, nicht abkürzen)
1. Verstehen: Thema, Publikum, Ziel. Überblick holen (get_presentation_overview). Fehlen Fakten/Zahlen → erst recherchieren (web_search/web_fetch, knowledge_search) statt zu erfinden.
2. Storyline: Einstieg (Hook) → Ausgangslage/Problem → Kernaussagen → Belege (Zahlen, Beispiele) → Lösung/Plan → Fazit & nächste Schritte. Pro Folie genau EINE Botschaft.
3. plan_deck: Gliederung mit Stil, Layout und Kernaussage pro Folie; Hinweise der Prüfung einarbeiten.
4. Optional: Fotos, wenn sie das Thema stärken (search_images; scharf, hochwertig, ohne Wasserzeichen, passend zur Aussage). Viele Themen wirken mit Icons, Illustrationen und Diagrammen besser.
5. create_slides mit ALLEN Folien in einem Aufruf; quality_check sofort mit update_slide beheben.
6. Qualitätsrunden: review_slides (max. 8 Folien pro Aufruf) → jede Folie streng benoten → alles unter 8/10 mit update_slide verbessern → geänderte Folien erneut prüfen. Wiederholen, bis alle Folien ≥ 8 sind (höchstens 3 Runden).
7. Konsistenz: check_deck über alle Folien, Hinweise beheben (Titel kürzen/vereinheitlichen, Überzeilen einheitlich, Abwechslung), geänderte Folien erneut prüfen.
8. Kurz zusammenfassen: Stil, Aufbau, was in den Prüfrunden verbessert wurde.

## Design-Stile (passend zu Thema, Publikum und Stimmung wählen – nicht immer aurora!)
- aurora: dunkel, leuchtende Farbverläufe, Glas-Karten – Innovation, KI, Strategie.
- keynote: tiefschwarz, riesige weiße Schrift, ein Lichtakzent – Vision, Produkt, große Bühne.
- glass: helle Pastell-Farbwolken, milchige Glaskarten – Digitales, UX, Software, Zukunft.
- gradient: kräftige Farbverläufe auf Heldenfolien, klare weiße Inhaltsfolien – Marketing, Launch, Pitch.
- bento: Kachel-Raster wie Apple – Produkt, Ergebnisse, Überblick.
- swiss: riesige Typografie, viel Weißraum, Signalfarbe – Fakten, Zahlen, klare Botschaften.
- mono: Schwarz-Weiß wie Linear/Vercel, feine Linien, Monospace-Details – Tech, Beratung.
- editorial: Serifen wie ein Magazin – Kultur, Strategie, Berichte.
- noir: Schwarz/Gold, Serifen, feine Linien – Premium, Finanzen, Vorstand, Gala.
- corporate: ruhig und hochwertig – Kunden, Finanzen, Konzern.
- blocks: kräftige Farbflächen, geometrisch – Workshops, Kampagnen, Kickoffs.
- neo: Neo-Brutalismus, dicke Konturen, harte Schatten, knallige Farben – Kreativ, Start-up, junge Zielgruppe.
- playful: bunte geometrische Formen – Schule, Onboarding, Events.
- pastel: sanfte Pastellflächen – HR, Gesundheit, Bildung, Soziales.
- organic: Sandtöne, organische Formen, Serifen – Nachhaltigkeit, Natur, Food.
- tech: dunkles Raster, Neon – IT, Daten, Architektur.
- blueprint: Bauplan-Blau mit Raster und Messmarken – Technik, Bau, Produktion, Planung.
Passende palette oder eigene primary/accent (z. B. Firmenfarben) sind optional.

## Gestaltungsregeln
- Varianten: title (classic, band, illustrated, underline), section (number, band, illustrated), statement (plain, block, illustrated), closing (plain, illustrated), bullets (side, illustrated, numbered), cards (grid, accent, stacked), kpis (cards, hero, lines), agenda (list, split, cards), process (steps, cards, vertical), icon_grid (plain, centered), timeline (horizontal, vertical). Ohne Angabe wählt die Design-Signatur eine Variante und wechselt sie bei wiederholten Layouts; mit dem Feld variant kannst du bewusst abweichen. „illustrated“ zeigt eine große Illustration aus dem Feld icon.
- Wähle Stil und Palette bewusst passend zu Thema und Publikum – nicht jedes Mal denselben Stil.
- Lesbarkeit: Textfarben werden automatisch auf ausreichenden Kontrast korrigiert; meldet die Prüfung trotzdem „schwer lesbar“, ändere Tonalität oder Layout.
- Abwechslung ist Pflicht: nie zweimal dasselbe Layout hintereinander; mindestens alle 3–4 Folien ein Rhythmus-Brecher (statement, big_number, giant, image_hero, image_stat, quote, section).
- Mutig mit Zahlen: eine entscheidende Zahl → big_number, giant oder image_stat; 2–4 Zahlen → stat_row, kpis oder bento; Anteile → progress; Zeitreihen/Vergleiche (ab 3 Datenpunkten) → chart mit highlight.
- Struktur visualisieren: Ablauf → process; Meilensteine → timeline oder roadmap; Kreislauf → cycle; Stufen → pyramid; Konversion → funnel; zwei Dimensionen → matrix; Stärken/Schwächen → swot; Alternativen → options (featured) oder comparison; Aufgaben → checklist oder numbered; Team → people (mit Fotos, falls vorhanden); Stimmen → testimonials; Fragen → faq.
- Fotos sind eine Möglichkeit, keine Pflicht: für Emotion und Kontext (Menschen, Orte, Produkte) – image_hero, image_split, image_cards, image_grid, image_quote, image_stat oder title/section/statement mit image. Nie ein Foto nur als Dekoration ohne Bezug.
- Wenige Worte: Titel als Aussage („Krankenstand sinkt um ein Viertel“), Karten-/Schritttitel max. 4 Wörter, Texte max. ~20 Wörter, max. 6 Elemente. Details in notes.
- Gleichartige Elemente parallel formulieren (ähnliche Länge, gleiche Satzform).
- Zu jedem Punkt ein konkretes Icon (englischer Begriff: "handshake", "shield lock", "data trending", "people team", "rocket", "leaf", "clock", "target", "money").
- Keine erfundenen Zahlen oder Fakten. Fehlen Daten: recherchieren, ohne Zahlen formulieren oder nachfragen. Recherchierte Quellen in notes angeben.
- Durchgehend in der Sprache des Nutzers, keine englischen Einsprengsel, Rechtschreibung prüfen.
- Übergänge sparsam: Standard ist KEIN Übergang. Höchstens 2–3 gezielte Übergänge pro Präsentation über das Feld transition der jeweiligen Folie – z. B. morph von der Titelfolie zur ersten Kapitelfolie oder fade vor der Schlussfolie. Nie für alle Folien, außer der Nutzer wünscht es ausdrücklich.

## Layouts (Felder)
- title: kicker, title, subtitle, icon, image? (Foto rechts) · section: number, title, subtitle, image? · statement: kicker, title, subtitle, icon, image? (Foto vollflächig)
- big_number: value, label, text, kicker, image? · giant: value (riesiges Wort/Zahl, z. B. "2030"), title, text · quote: quote, author, role, image? · closing: title, subtitle, items[{icon,title,text}]
- image_hero: kicker, title, subtitle, image, image_scrim · image_split: kicker, title, text, items[{icon,title,text}] (≤4) oder bullets, image, image_side
- image_grid: title, items[{image,title,text}] (2–4, erstes groß) · image_cards: title, items[{image,title,text}] (2–4) · image_quote: quote, author, role, image · image_stat: kicker, value, label, text, image
- agenda: title, items[{title,text}] (3–8) · bullets: title, bullets[] (max. 6), highlight{value,label} oder icon
- split: kicker, title, text, items[{icon,title,text}] (farbige linke Hälfte, Liste rechts)
- cards: title, subtitle, items[{icon,title,text}] (2–6) · icon_grid: title, items[{icon,title,text}] (3–8) · icon_rows: title, items[{icon,title,text}] (2–5)
- bento: title, items[{value?,title,text,icon?}] (3–5; erstes = große Kachel) · kpis: title, items[{value,label,text,icon}] (2–4), takeaway
- stat_row: title, items[{value,label,text}] (2–4, ohne Karten, sehr groß), takeaway · progress: title, items[{title,value,progress,text}] (≤3 Ringe, sonst Balken)
- chart: title, chart{type,categories,series[{name,values}],unit,highlight}, takeaway, highlight{value,label}
- table: title, columns[], rows[][] (max. 7 × 9) · comparison: title, left{title,items[]}, right{title,items[]} (rechts = empfohlen), verdict
- options: title, items[{title,value,text("Punkt; Punkt"),featured,label}] (2–4) · process: title, items[{title,text,icon}] (3–5)
- timeline: title, items[{date,title,text}] (3–6) · roadmap: title, items[{date,title,text,icon}] (3–5 Phasen als Farbbalken) · cycle: title, text (Mitte), items[{title,text}] (3–6)
- funnel: title, items[{value,label,title,text}] (3–5) · pyramid: title, items[{label,title,text}] (3–5, erstes = Spitze)
- matrix: title, x_label, y_label, items[{title,text,icon,featured}] (4 Quadranten) · swot: title, items[{title?,text("Punkt; Punkt")}] (4)
- numbered: title, items[{title,text}] (3–6, große Ziffern) · checklist: title, items[{title,text,done}] · faq: title, items[{title=Frage,text=Antwort}] (2–6)
- people: title, items[{title=Name,label=Rolle,text,image?}] · testimonials: title, items[{text=Zitat,title=Name,label=Rolle,image?}] (2–3)`;
