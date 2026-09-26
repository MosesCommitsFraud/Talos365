// Rückfragen (wie ask_user in Talos): Das Modell stellt 1–3 Fragen mit Antwortoptionen,
// der Auftrag endet, und die Oberfläche zeigt eine Karte über dem Eingabefeld. Die Antwort
// kommt als nächste Nachricht des Nutzers zurück.
import type { HostTool } from '@/lib/types';

export interface AskOption {
  label: string;
  description?: string;
}
export interface AskQuestion {
  question: string;
  options: AskOption[];
  multi?: boolean;
}

function normalize(a: Record<string, unknown>): AskQuestion[] {
  const raw = Array.isArray(a.questions) ? a.questions : a.question ? [a] : [];
  return (raw as Array<Record<string, unknown>>)
    .map((q) => ({
      question: String(q.question ?? '').trim(),
      options: (Array.isArray(q.options) ? q.options : [])
        .map((o: unknown) => (typeof o === 'string' ? { label: o } : (o as AskOption)))
        .filter((o: AskOption) => o && String(o.label ?? '').trim())
        .slice(0, 6)
        .map((o: AskOption) => ({ label: String(o.label).trim(), ...(o.description ? { description: String(o.description).trim() } : {}) })),
      multi: !!q.multi,
    }))
    .filter((q) => q.question)
    .slice(0, 3);
}

/** Wurden in diesem Chat schon Rückfragen gestellt? (für die Pflicht-Rückfrage bei neuen Präsentationen) */
let askedInChat = false;
export const hasAskedInChat = () => askedInChat;
export function resetAsked(value = false) {
  askedInChat = value;
}

export const askTool: HostTool = {
  name: 'ask_user',
  description:
    'Stellt dem Nutzer eine Rückfrage mit anklickbaren Antworten (oder freiem Text). Nur wenn die Aufgabe wirklich mehrdeutig ist und die Antwort ändert, was du tust – z. B. Zielgruppe, Umfang, Stil oder Schwerpunkt einer neuen Präsentation, oder welche von mehreren Varianten gemeint ist. Bis zu 3 Fragen auf einmal, je 2–6 kurze Optionen (label, optional description); ohne Optionen = freie Antwort. Keine Option „Sonstiges/Andere“ – ein Feld für eine eigene Antwort gibt es immer. Der Aufruf BEENDET deinen Auftrag; die Antwort kommt als nächste Nachricht. Nie Auswahlmenüs als Text schreiben – dafür ist dieses Werkzeug da.',
  parameters: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        description: '1–3 Fragen',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string', description: 'Kurze, klare Frage' },
            options: {
              type: 'array',
              items: {
                type: 'object',
                properties: { label: { type: 'string', description: 'Kurz, max. ~6 Wörter' }, description: { type: 'string' } },
                required: ['label'],
              },
            },
            multi: { type: 'boolean', description: 'Mehrfachauswahl erlaubt' },
          },
          required: ['question'],
        },
      },
    },
    required: ['questions'],
  },
  run: async (a) => {
    const questions = normalize(a);
    if (!questions.length) throw new Error('Keine Frage angegeben. Format: {"questions": [{"question": "...", "options": [{"label": "..."}]}]}');
    askedInChat = true;
    return { gestellt: questions.length, hinweis: 'Die Frage liegt dem Nutzer vor. Warte auf die Antwort.', __ask: questions };
  },
};

export const ASK_PROMPT = `

## Rückfragen
- Rückfragen sind ein Angebot, keine Pflicht. Nutze ask_user, wenn wichtige Angaben fehlen und das Ergebnis stark davon abhängt (z. B. Publikum, Umfang oder Stil einer neuen Präsentation; unklar, welcher Teil gemeint ist). Gebündelt bis zu 3 kurze Fragen mit sinnvollen Optionen. Kannst du mit guten Annahmen loslegen, tu das und nenne die Annahmen kurz.
- Nach ask_user nichts weiter tun – die Antwort kommt als nächste Nachricht.
- Ist der Auftrag klar genug oder gibt es naheliegende Standards, arbeite ohne Rückfrage.
- WICHTIG: Rückfragen stellst du AUSSCHLIESSLICH durch einen Aufruf des Werkzeugs ask_user – nie als Text, nie als Liste oder Aufzählung in deiner Antwort. Eine als Text geschriebene Frage kann der Nutzer nicht anklicken.`;

/** Antworten des Nutzers als Nachricht an das Modell */
export function formatAnswers(questions: AskQuestion[], answers: string[]): string {
  if (questions.length === 1) return answers[0] ?? '';
  return questions.map((q, i) => `${q.question} → ${answers[i] || '(übersprungen)'}`).join('\n');
}

/** Auffangnetz: Das Modell schreibt Rückfragen manchmal als Text-Liste statt ask_user zu
 *  nutzen („**1. Wer soll …?**“ + Aufzählung). Solche Antworten werden in die Rückfrage-Karte
 *  umgewandelt; übrig bleibt der Einleitungssatz. */
export function extractQuestions(text: string): { intro: string; questions: AskQuestion[] } | null {
  const clean = (s: string) =>
    s
      .replace(/\*\*|__|`/g, '')
      .replace(/^#{1,6}\s*/, '')
      .replace(/^\s*(?:\d+[.)]|[a-z][.)])\s+/i, '')
      .trim();
  const bullet = /^\s*(?:[-*•–]|\d+[.)]|[a-z][.)])\s+(.+)$/i;
  const lines = text.split('\n');
  const questions: AskQuestion[] = [];
  let firstQuestionLine = -1;
  let current: AskQuestion | null = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = clean(raw);
    if (!line) continue;
    if (line.endsWith('?') && line.length <= 200) {
      current = { question: line, options: [] };
      questions.push(current);
      if (firstQuestionLine < 0) firstQuestionLine = i;
      continue;
    }
    const m = bullet.exec(raw);
    if (current && m) {
      let label = clean(m[1]);
      let description: string | undefined;
      const paren = /^(.*?)\s*\((.+)\)\s*$/.exec(label);
      const dash = /^(.*?)\s+[–—-]\s+(.+)$/.exec(label);
      if (paren && paren[1]) [label, description] = [paren[1].trim(), paren[2].trim()];
      else if (dash && dash[1] && dash[1].length <= 40) [label, description] = [dash[1].trim(), dash[2].trim()];
      if (label && current.options.length < 6) current.options.push({ label, ...(description ? { description } : {}) });
      continue;
    }
    // Anderer Text nach einer Frage beendet deren Optionsliste
    if (current && current.options.length) current = null;
  }
  const usable = questions.filter((q) => q.options.length >= 2).slice(0, 3);
  if (!usable.length) return null;
  const intro = lines
    .slice(0, Math.max(0, firstQuestionLine))
    .join('\n')
    .trim();
  return { intro, questions: usable };
}
