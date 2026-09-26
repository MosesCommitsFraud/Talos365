import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Theme = 'system' | 'light' | 'dark';

interface Visibility {
  showThinking: boolean;
  messageMetrics: boolean;
}

interface PrefsState {
  theme: Theme;
  /** Tatsächlich aktives Design (Office-Design bei `system`). */
  resolvedDark: boolean;
  reasoning: boolean;
  visibility: Visibility;
  endpoint: string;
  model: string;
  temperature: number;
  maxSteps: number;
  confirmWrites: boolean;
  /** Websuche (Talos/SearXNG) für die nächsten Nachrichten */
  useWeb: boolean;
  /** Talos-Wissensdatenbank */
  useRag: boolean;
  setTheme: (theme: Theme) => void;
  setResolvedDark: (dark: boolean) => void;
  toggle: (key: 'reasoning' | 'confirmWrites' | 'useWeb' | 'useRag') => void;
  setVisibility: (key: keyof Visibility, value: boolean) => void;
  set: (patch: Partial<Pick<PrefsState, 'endpoint' | 'model' | 'temperature' | 'maxSteps'>>) => void;
}

const safeStorage = createJSONStorage(() => {
  try {
    return window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
  }
});

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      theme: 'system',
      resolvedDark: false,
      reasoning: true,
      visibility: { showThinking: true, messageMetrics: true },
      endpoint: '/llm',
      model: 'qwen3-llm',
      temperature: 0.2,
      maxSteps: 60,
      confirmWrites: false,
      useWeb: true,
      useRag: true,
      setTheme: (theme) => set({ theme }),
      setResolvedDark: (resolvedDark) => set({ resolvedDark }),
      toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<PrefsState>),
      setVisibility: (key, value) => set((s) => ({ visibility: { ...s.visibility, [key]: value } })),
      set: (patch) => set(patch),
    }),
    {
      name: 'talos-office.prefs',
      version: 1,
      // v1: mehr Schritte für mehrere Qualitätsrunden
      migrate: (state) => {
        const s = state as { maxSteps?: number };
        if (!s.maxSteps || s.maxSteps < 60) s.maxSteps = 60;
        return s as never;
      },
      storage: safeStorage,
      partialize: ({ resolvedDark: _unused, ...rest }) => rest,
    },
  ),
);
