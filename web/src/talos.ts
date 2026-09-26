// Anbindung an Talos im Intranet (über den lokalen Server-Proxy):
// - Websuche und Webseiten über Talos' SearXNG (MCP-Werkzeuge web_search / web_fetch)
// - Skills: Talos-Skill-Bibliothek (MCP) + lokale SKILL.md-Ordner (z. B. C:\DEV\Talos\sample_skills)
// - Wissensdatenbank (MCP rag_query)
import type { Citation, HostTool } from '@/lib/types';

let rpcId = 0;

/** Ruft ein MCP-Werkzeug von Talos auf und liefert dessen Textergebnis. */
export async function talosMcp(name: string, args: Record<string, unknown> = {}): Promise<string> {
  const res = await fetch('/talos/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: 'tools/call', params: { name, arguments: args } }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Talos nicht erreichbar (HTTP ${res.status}): ${raw.slice(0, 200)}`);
  // Antwort als JSON oder als SSE-Stream („data: {…}“)
  const json = raw.trim().startsWith('{') ? JSON.parse(raw) : JSON.parse(raw.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5)).pop() ?? '{}');
  if (json.error) throw new Error(json.error.message ?? 'Talos-Fehler');
  const text = (json.result?.content ?? []).map((c: { text?: string }) => c.text ?? '').join('\n').trim();
  if (json.result?.isError) throw new Error(text || 'Talos-Werkzeug fehlgeschlagen');
  return text;
}

// ── Skills ─────────────────────────────────────────────────────────────────

export interface SkillInfo {
  name: string;
  description: string;
  source: 'lokal' | 'talos';
  references?: string[];
}

let skillCache: { at: number; list: SkillInfo[] } | null = null;

async function localSkills(): Promise<SkillInfo[]> {
  try {
    const res = await fetch('/skills');
    if (!res.ok) return [];
    const list = (await res.json()) as Array<{ name: string; description: string; references?: string[] }>;
    return list.map((s) => ({ ...s, source: 'lokal' as const }));
  } catch {
    return [];
  }
}

/** Talos-Skills: skills_list liefert Markdown – Namen und Beschreibungen herauslesen. */
async function talosSkills(): Promise<SkillInfo[]> {
  try {
    const text = await talosMcp('skills_list');
    if (/no published skills/i.test(text)) return [];
    const out: SkillInfo[] = [];
    for (const line of text.split('\n')) {
      const m = /^\s*(?:[-*]|\d+\.)\s*\*{0,2}`?([\w.-]+)`?\*{0,2}\s*[—:–-]\s*(.+)$/.exec(line);
      if (m) out.push({ name: m[1], description: m[2].trim(), source: 'talos' });
    }
    return out;
  } catch {
    return [];
  }
}

/** Alle verfügbaren Skills (lokal + Talos), 5 Minuten zwischengespeichert. */
export async function allSkills(): Promise<SkillInfo[]> {
  if (skillCache && Date.now() - skillCache.at < 5 * 60_000) return skillCache.list;
  const [local, remote] = await Promise.all([localSkills(), talosSkills()]);
  const names = new Set(local.map((s) => s.name));
  const list = [...local, ...remote.filter((s) => !names.has(s.name))];
  skillCache = { at: Date.now(), list };
  return list;
}

/** Skill-Übersicht für den Systemprompt (wie Talos sie seinem Agenten gibt). */
export async function skillsPrompt(): Promise<string> {
  const list = await allSkills();
  if (!list.length) return '';
  const lines = list.map((s) => `- ${s.name}: ${s.description.slice(0, 300)}`);
  return `\n\n## Skills\nSkills sind geprüfte Arbeitsanleitungen. Passt eine zur Aufgabe, lies sie ZUERST mit read_skill und folge ihr (angepasst an Office – Werkzeuge, die es hier nicht gibt, ersetzt du durch die vorhandenen).\n${lines.join('\n')}`;
}

async function readSkill(name: string, file?: string): Promise<string> {
  const list = await allSkills();
  const skill = list.find((s) => s.name === name) ?? list.find((s) => s.name.toLowerCase() === name.toLowerCase());
  if (!skill) throw new Error(`Skill „${name}“ nicht gefunden. Verfügbar: ${list.map((s) => s.name).join(', ') || 'keine'}`);
  if (skill.source === 'lokal') {
    const res = await fetch(`/skills/read?name=${encodeURIComponent(skill.name)}${file ? `&path=${encodeURIComponent(file)}` : ''}`);
    if (!res.ok) throw new Error(await res.text());
    return res.text();
  }
  return file ? talosMcp('skills_read_reference', { name: skill.name, path: file }) : talosMcp('skills_get', { name: skill.name });
}

const MAX = 14000;
const clip = (s: string) => (s.length > MAX ? `${s.slice(0, MAX)}\n… [gekürzt]` : s);

// ── Quellen-Nummern ([n]) ────────────────────────────────────────────────
// Wie in Talos (src/citations.py): jeder Treffer und jede gelesene Seite bekommt eine
// Nummer, die im ganzen Chat gleich bleibt. Das Modell schreibt „[n]“ hinter die Aussage,
// die Oberfläche macht daraus eine Quellen-Pille.

let nextCite = 1;
const citeByUrl = new Map<string, number>();

/** Nummerierung zurücksetzen (neuer Chat) bzw. an einen geladenen Chat anschließen. */
export function resetCitations(existing: Citation[] = []) {
  citeByUrl.clear();
  nextCite = 1;
  for (const c of existing) {
    if (c.url) citeByUrl.set(c.url, c.n);
    nextCite = Math.max(nextCite, c.n + 1);
  }
}

function siteOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function citeNumber(url: string) {
  let n = citeByUrl.get(url);
  if (!n) {
    n = nextCite++;
    citeByUrl.set(url, n);
  }
  return n;
}

const CITE_HINT = 'Belege Aussagen aus diesen Quellen in deiner Chat-Antwort direkt dahinter mit ihrer Nummer in eckigen Klammern, z. B. „… um 20 % gestiegen [3].“ Keine Links ausschreiben, keine eigene Quellenliste.';

/** Treffer von Talos' web_search („1. **Titel**“, darunter Link, Auszug, Suchmaschine) nummerieren. */
function numberSearch(text: string): { text: string; __citations: Citation[] } {
  const items: Array<{ title: string; url: string; snippet: string[] }> = [];
  for (const line of text.split('\n')) {
    const head = /^\s*\d+\.\s+\*\*(.*?)\*\*\s*$/.exec(line);
    if (head) {
      items.push({ title: head[1], url: '', snippet: [] });
      continue;
    }
    const cur = items[items.length - 1];
    if (!cur) continue;
    const s = line.trim();
    if (!cur.url && /^https?:\/\//.test(s)) cur.url = s;
    else if (s && !/^_.*_$/.test(s) && !/^These are search-engine snippets/.test(s)) cur.snippet.push(s);
  }
  const hits = items.filter((i) => i.url);
  if (!hits.length) return { text, __citations: [] };
  const citations: Citation[] = hits.map((h) => ({
    n: citeNumber(h.url),
    kind: 'web',
    title: h.title,
    url: h.url,
    site: siteOf(h.url),
    snippet: h.snippet.join(' ').slice(0, 400),
    published: /^(\d{1,2}\.\d{1,2}\.\d{4})/.exec(h.snippet[0] ?? '')?.[1],
  }));
  const body = citations.map((c) => `[${c.n}] ${c.title}\n    ${c.url}\n    ${c.snippet}`).join('\n');
  return {
    text: `Suchtreffer (Auszüge, nicht die ganzen Seiten – Details bei Bedarf mit web_fetch):\n${body}\n\n${CITE_HINT}`,
    __citations: citations,
  };
}

/** Gelesene Webseite: dieselbe Nummer wie der Suchtreffer, sonst eine neue. */
function numberFetch(url: string, text: string): { text: string; __citations: Citation[] } {
  const n = citeNumber(url);
  const title = /^Title:\s*(.+)$/m.exec(text)?.[1]?.trim() || siteOf(url);
  const body = text.replace(/^Fetched:.*\n?/m, '').replace(/^Title:.*\n?/m, '').trim();
  const snippet = body.replace(/\[Page content is source material[^\]]*\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 400);
  return {
    text: `[${n}] ${title} – ${url}\n\n${body}\n\n${CITE_HINT}`,
    __citations: [{ n, kind: 'web', title, url, site: siteOf(url), snippet }],
  };
}

// ── Werkzeuge ──────────────────────────────────────────────────────────────

export const talosTools: HostTool[] = [
  {
    name: 'web_search',
    description: 'Durchsucht das Internet (über Talos/SearXNG). Für aktuelle Fakten, Zahlen und Quellen. Liefert Titel, Link und Auszug.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Suchanfrage (präzise, gern mit Jahr)' },
        max_results: { type: 'integer', description: 'Anzahl Treffer (Standard 6)' },
        time_range: { type: 'string', enum: ['day', 'week', 'month', 'year'], description: 'Nur aktuelle Treffer (optional)' },
        category: { type: 'string', enum: ['general', 'news', 'science', 'it'], description: 'Kategorie (optional, z. B. news)' },
      },
      required: ['query'],
    },
    run: async (a) =>
      numberSearch(
        await talosMcp('web_search', {
          query: String(a.query ?? ''),
          language: 'de',
          ...(a.max_results ? { max_results: Number(a.max_results) } : {}),
          ...(a.time_range ? { time_range: String(a.time_range) } : {}),
          ...(a.category ? { category: String(a.category) } : {}),
        }),
      ),
  },
  {
    name: 'web_fetch',
    description: 'Liest den Text einer Webseite (z. B. einen Treffer aus web_search), um Fakten genau zu übernehmen.',
    parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    run: async (a) => {
      const url = String(a.url ?? '');
      const r = numberFetch(url, await talosMcp('web_fetch', { url }));
      return { ...r, text: clip(r.text) };
    },
  },
  {
    name: 'list_skills',
    description: 'Listet die verfügbaren Skills (Arbeitsanleitungen aus Talos und lokalen Skill-Ordnern), optional nach Stichwort gefiltert.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'Stichwort (optional)' } } },
    run: async (a) => {
      const q = String(a.query ?? '').toLowerCase().trim();
      const list = await allSkills();
      const hits = q ? list.filter((s) => `${s.name} ${s.description}`.toLowerCase().includes(q)) : list;
      return hits.map((s) => ({ name: s.name, description: s.description, source: s.source, references: s.references }));
    },
  },
  {
    name: 'read_skill',
    description: 'Liest einen Skill (SKILL.md) oder eine seiner Referenzdateien. Vor Aufgaben lesen, zu denen ein Skill passt.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name des Skills' },
        file: { type: 'string', description: 'Optional: Referenzdatei im Skill-Ordner, z. B. "references/layout.md"' },
      },
      required: ['name'],
    },
    run: async (a) => clip(await readSkill(String(a.name ?? ''), a.file ? String(a.file) : undefined)),
  },
  {
    name: 'knowledge_search',
    description: 'Durchsucht die Talos-Wissensdatenbank (interne Dokumente) und liefert passende Textstellen mit Quelle.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        collections: { type: 'array', items: { type: 'string' }, description: 'Optional: bestimmte Wissensdatenbanken' },
      },
      required: ['query'],
    },
    run: async (a) => clip(await talosMcp('rag_query', { query: String(a.query ?? ''), ...(Array.isArray(a.collections) ? { collections: a.collections } : {}), topK: 6 })),
  },
];

export const TALOS_PROMPT = `

## Recherche
- Für aktuelle Fakten, Zahlen und Belege: web_search, bei Bedarf web_fetch für Details. Keine Zahlen erfinden – lieber recherchieren.
- Für interne Inhalte (Firmendokumente, Richtlinien): knowledge_search.
- Quellen sind nummeriert. In der Chat-Antwort belegst du Fakten mit der Nummer in eckigen Klammern direkt hinter der Aussage, z. B. [2]. In Dokumenten/Folien stattdessen Quelle als Text (Titel/Website) in Fußnote oder Sprechernotizen.`;
