// Microsoft Fluent UI System Icons (MIT) – dieselbe Icon-Sprache wie Office.
// Die SVGs liegen unter /icons/ (beim Build aus @fluentui/svg-icons kopiert) und
// werden als SVG-Grafik eingebettet: in PowerPoint wie ein eingefügtes Office-Icon
// umfärbbar und „In Form konvertieren“-fähig.

let names: string[] | null = null;
let loading: Promise<string[]> | null = null;

export async function iconNames(): Promise<string[]> {
  if (names) return names;
  loading ??= fetch('/icons/index.json')
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [])
    .then((list: string[]) => (names = list));
  return loading;
}

/** Häufige deutsche Begriffe → Fluent-Namensteile */
const DE: Record<string, string> = {
  // Englische Begriffe ohne eigenes Fluent-Icon
  solar: 'weather sunny', sun: 'weather sunny', photovoltaic: 'weather sunny', wind: 'weather squalls', energy: 'flash',
  electricity: 'flash', power: 'flash', water: 'drop', tree: 'tree deciduous', forest: 'tree deciduous', factory: 'building factory',
  question: 'question circle', faq: 'question circle', sustainability: 'leaf one', eco: 'leaf one', climate: 'leaf one',
  sonne: 'weather sunny', wasser: 'drop', wald: 'tree deciduous', fabrik: 'building factory', werk: 'building factory',
  geld: 'money', umsatz: 'money', kosten: 'money', finanzen: 'money', euro: 'currency',
  team: 'people team', mitarbeiter: 'people', menschen: 'people', kunde: 'person', kunden: 'people',
  ziel: 'target', ziele: 'target', idee: 'lightbulb', ideen: 'lightbulb', innovation: 'lightbulb',
  sicherheit: 'shield', schutz: 'shield', wachstum: 'arrow trending', trend: 'arrow trending',
  zeit: 'clock', termin: 'calendar', kalender: 'calendar', daten: 'database', datenbank: 'database',
  diagramm: 'data bar vertical', analyse: 'data trending', statistik: 'data pie', rakete: 'rocket',
  start: 'rocket', erfolg: 'trophy', preis: 'tag', welt: 'globe', international: 'globe',
  gebäude: 'building', firma: 'building', unternehmen: 'building', werkzeug: 'wrench', technik: 'settings',
  einstellungen: 'settings', prozess: 'flow', ablauf: 'flow', schritt: 'arrow right', herz: 'heart',
  gesundheit: 'heart pulse', bildung: 'hat graduation', lernen: 'book', dokument: 'document',
  vertrag: 'document signature', recht: 'gavel', gesetz: 'gavel', energie: 'flash', strom: 'flash',
  umwelt: 'leaf', natur: 'leaf', nachhaltigkeit: 'leaf', auto: 'vehicle car', logistik: 'vehicle truck',
  lieferung: 'box', paket: 'box', lager: 'box multiple', einkauf: 'cart', handel: 'cart', ki: 'bot',
  roboter: 'bot', software: 'code', code: 'code', cloud: 'cloud', server: 'server', netzwerk: 'globe',
  kommunikation: 'chat', gespräch: 'chat', frage: 'question', hilfe: 'question circle', warnung: 'warning',
  risiko: 'warning', check: 'checkmark circle', erledigt: 'checkmark circle', qualität: 'ribbon',
  stern: 'star', favorit: 'star', suche: 'search', mail: 'mail', telefon: 'call', ort: 'location',
  standort: 'location', schlüssel: 'key', schloss: 'lock closed', handshake: 'handshake', partner: 'handshake',
  strategie: 'chess', plan: 'clipboard task', aufgabe: 'task list', liste: 'list', präsentation: 'presenter',
  foto: 'image', video: 'video', musik: 'music note 2', sprache: 'translate', gesicht: 'emoji',
};

function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .split(/\s+/)
    .flatMap((t) => (DE[t] ? DE[t].split(' ') : [t]))
    .filter(Boolean);
}

/** Bestes Icon zum Suchbegriff (englisch oder deutsch), z. B. „people team“ → people_team. */
export async function resolveIcon(query: string | undefined): Promise<string | null> {
  if (!query) return null;
  const list = await iconNames();
  if (!list.length) return null;
  const exact = query.toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (list.includes(exact)) return exact;
  return searchIcons(query, list, 1)[0] ?? null;
}

export function searchIcons(query: string, list: string[], limit = 12): string[] {
  const q = tokens(query);
  if (!q.length) return [];
  const scored: Array<[string, number]> = [];
  for (const name of list) {
    const parts = name.split('_');
    let score = 0;
    for (const t of q) {
      if (parts.includes(t)) score += 3;
      else if (parts.some((p) => p.startsWith(t) || t.startsWith(p))) score += 1;
    }
    if (score > 0) {
      // Kürzere, allgemeinere Namen bevorzugen
      scored.push([name, score - parts.length * 0.3 + (parts[0] === q[0] ? 1 : 0)]);
    }
  }
  return scored.sort((a, b) => b[1] - a[1]).slice(0, limit).map(([n]) => n);
}

// ── Inline-SVG für die HTML-Layouts ──
const inlineCache = new Map<string, string>(); // Suchbegriff → SVG-Pfaddaten (inneres Markup)

async function loadSvg(name: string, style: 'filled' | 'regular'): Promise<string> {
  const key = `${name}_24_${style}`;
  if (svgCache.has(key)) return svgCache.get(key)!;
  const res = await fetch(`/icons/${key}.svg`).catch(() => null);
  const svg = res?.ok ? await res.text() : '';
  svgCache.set(key, svg);
  return svg;
}

/** Lädt alle benötigten Icons vorab (Suchbegriff → bestes Fluent-Icon). */
export async function preloadIcons(queries: Array<string | undefined>, style: 'filled' | 'regular' = 'regular') {
  await Promise.all(
    [...new Set(queries.filter((q): q is string => !!q && !!q.trim()))].map(async (q) => {
      const cacheKey = `${style}:${q}`;
      if (inlineCache.has(cacheKey)) return;
      // Bester Treffer, sonst die nächsten Kandidaten – nie ein leeres Icon
      const list = await iconNames();
      const first = await resolveIcon(q);
      const candidates = [...new Set([first, ...searchIcons(q, list, 6), 'sparkle', 'circle'].filter((x): x is string => !!x))];
      let svg = '';
      for (const name of candidates) {
        svg = (await loadSvg(name, style)) || (await loadSvg(name, style === 'filled' ? 'regular' : 'filled'));
        if (svg) break;
      }
      const inner = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(svg)?.[1] ?? '';
      inlineCache.set(cacheKey, inner);
    }),
  );
}

/** Inline-SVG eines vorab geladenen Icons (leer, falls keins gefunden). */
export function iconSvg(query: string | undefined, size: number, color: string, style: 'filled' | 'regular' = 'regular'): string {
  if (!query) return '';
  const inner = inlineCache.get(`${style}:${query}`) ?? inlineCache.get(`${style === 'filled' ? 'regular' : 'filled'}:${query}`);
  if (!inner) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="#${color}" style="display:block;flex:none">${inner}</svg>`;
}

const svgCache = new Map<string, string>();

/** SVG des Icons in einer Farbe, als base64-Daten für pptxgenjs. */
export async function iconData(name: string, color: string, style: 'filled' | 'regular' = 'filled'): Promise<string | null> {
  const key = `${name}_24_${style}`;
  let svg = svgCache.get(key);
  if (svg === undefined) {
    const res = await fetch(`/icons/${key}.svg`).catch(() => null);
    svg = res?.ok ? await res.text() : '';
    if (!svg && style === 'filled') return iconData(name, color, 'regular');
    svgCache.set(key, svg);
  }
  if (!svg) return null;
  // Farbe am Wurzelelement setzen – die Pfade erben sie.
  // Große Nenngröße: pptxgenjs erzeugt daraus die PNG-Ersatzgrafik (sonst 24 px, unscharf).
  const colored = svg
    .replace('<svg ', `<svg fill="#${color}" `)
    .replace('width="24"', 'width="256"')
    .replace('height="24"', 'height="256"');
  // Mit „data:“-Präfix – pptxgenjs lädt den Wert direkt als <img src> für die PNG-Vorschau.
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(colored)))}`;
}
