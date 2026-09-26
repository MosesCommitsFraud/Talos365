// Chatverlauf: Unterhaltungen werden nach jeder Antwort lokal gespeichert
// (localStorage, pro Rechner) und lassen sich über den Verlauf-Knopf wieder öffnen.
import { create } from 'zustand';
import type { UiMessage } from '@/lib/types';

export interface SavedChat {
  id: string;
  title: string;
  host: string;
  updatedAt: number;
  messages: UiMessage[];
  /** Verlauf im API-Format, damit das Modell nahtlos weitermachen kann */
  api: unknown[];
}

const KEY = 'talos365.chats.v1';
const MAX_CHATS = 40;

function read(): SavedChat[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as SavedChat[];
  } catch {
    return [];
  }
}

/** Speichergerecht machen: keine Bilder, lange Werkzeugausgaben gekürzt. */
function slim(chat: SavedChat): SavedChat {
  const cut = (s: string | undefined, n: number) => (s && s.length > n ? `${s.slice(0, n)} …` : s);
  return {
    ...chat,
    messages: chat.messages.map((m) => ({
      ...m,
      streaming: false,
      tools: m.tools?.map((t) => ({ ...t, images: undefined, output: cut(t.output, 1500), command: cut(t.command, 1500) })),
    })),
    api: chat.api.map((m) => {
      const msg = m as { role: string; content: unknown };
      if (Array.isArray(msg.content)) return { ...msg, content: '[Folienbilder aus dem Selbstcheck – nicht gespeichert]' };
      if (msg.role === 'tool' && typeof msg.content === 'string') return { ...msg, content: cut(msg.content, 4000) };
      return msg;
    }),
  };
}

function write(list: SavedChat[]) {
  let items = list.slice(0, MAX_CHATS).map(slim);
  // Bei vollem Speicher die ältesten Unterhaltungen verwerfen
  while (items.length) {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
      return;
    } catch {
      items = items.slice(0, -1);
    }
  }
}

interface HistoryState {
  chats: SavedChat[];
  currentId: string | null;
  save: (chat: SavedChat) => void;
  remove: (id: string) => void;
  setCurrent: (id: string | null) => void;
  refresh: () => void;
}

export const useHistory = create<HistoryState>()((set, get) => ({
  chats: read(),
  currentId: null,
  save: (chat) => {
    const list = [chat, ...get().chats.filter((c) => c.id !== chat.id)];
    write(list);
    set({ chats: read(), currentId: chat.id });
  },
  remove: (id) => {
    const list = get().chats.filter((c) => c.id !== id);
    write(list);
    set({ chats: list, currentId: get().currentId === id ? null : get().currentId });
  },
  setCurrent: (currentId) => set({ currentId }),
  refresh: () => set({ chats: read() }),
}));

/** Titel aus der ersten Nutzernachricht */
export function chatTitle(messages: UiMessage[]): string {
  const first = messages.find((m) => m.role === 'user')?.content ?? 'Neuer Chat';
  const clean = first.replace(/\s+/g, ' ').trim();
  return clean.length > 60 ? `${clean.slice(0, 58)}…` : clean;
}
