/** Ein Werkzeugaufruf, wie ihn die Talos-Komponenten (ToolGroup/ToolRow) erwarten.
 *  `command` trägt die Argumente als JSON – genau wie im Talos-Backend. */
export interface ToolCall {
  id: string;
  tool: string;
  command?: string;
  output?: string;
  status: 'running' | 'done' | 'error';
  diff?: string;
  /** Bilder, die das Werkzeug erzeugt hat (z. B. Folien-Selbstcheck) */
  images?: Array<{ label?: string; url: string }>;
}

/** Nummerierte Quelle (Websuche/Webseite), auf die die Antwort mit „[n]“ verweist – wie in Talos. */
export interface Citation {
  n: number;
  kind: 'web' | 'rag';
  title: string;
  snippet: string;
  url?: string;
  site?: string;
  published?: string;
  page?: number | string;
}

export interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  tools?: ToolCall[];
  streaming?: boolean;
  error?: boolean;
  createdAt: number;
  turnElapsedMs?: number;
  /** Rückfrage des Modells (ask_user) – Karte über dem Eingabefeld, solange offen */
  ask?: Array<{ question: string; options: Array<{ label: string; description?: string }>; multi?: boolean }>;
  /** Rückfrage beantwortet oder übersprungen */
  askDone?: boolean;
  /** Popup geschlossen, Frage noch offen (im Verlauf wieder zu öffnen) */
  askClosed?: boolean;
  /** Markierung im Dokument, die mit der Nachricht mitgeschickt wurde (Anzeige als Chip) */
  selection?: string;
  /** Quellen, die Werkzeuge dieser Runde nummeriert haben */
  citations?: Citation[];
}

/** Werkzeug aus public/tools-*.js (klassische Skripte, window.HostTools). */
export interface HostTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface HostToolset {
  label: string;
  prompt: string;
  suggestions: string[];
  tools: HostTool[];
  /** Zu Beginn jedes Auftrags (z. B. Zähler der Qualitätsrunden zurücksetzen) */
  onTurnStart?: () => void;
  /** Vor dem Abschluss: Hinweis, falls noch etwas fehlt (z. B. Selbstcheck) – das Modell arbeitet dann weiter */
  finishCheck?: () => string | null;
}

declare global {
  interface Window {
    HostTools?: Record<string, HostToolset>;
    Office?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}
