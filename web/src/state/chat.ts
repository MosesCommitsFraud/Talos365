import { create } from 'zustand';
import type { ToolCall, UiMessage } from '@/lib/types';

export interface PendingConfirm {
  callId: string;
  resolve: (ok: boolean) => void;
}

interface ChatState {
  messages: UiMessage[];
  streaming: boolean;
  turnStartedAt: number | null;
  pendingConfirm: PendingConfirm | null;
  addMessage: (msg: UiMessage) => void;
  patchMessage: (id: string, patch: Partial<UiMessage> | ((m: UiMessage) => Partial<UiMessage>)) => void;
  patchTool: (msgId: string, callId: string, patch: Partial<ToolCall>) => void;
  setStreaming: (streaming: boolean) => void;
  setPendingConfirm: (p: PendingConfirm | null) => void;
  reset: () => void;
}

export const useChat = create<ChatState>()((set) => ({
  messages: [],
  streaming: false,
  turnStartedAt: null,
  pendingConfirm: null,
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  patchMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m)),
    })),
  patchTool: (msgId, callId, patch) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === msgId ? { ...m, tools: (m.tools ?? []).map((c) => (c.id === callId ? { ...c, ...patch } : c)) } : m,
      ),
    })),
  setStreaming: (streaming) => set({ streaming, turnStartedAt: streaming ? Date.now() : null }),
  setPendingConfirm: (pendingConfirm) => set({ pendingConfirm }),
  reset: () => set({ messages: [], streaming: false, turnStartedAt: null, pendingConfirm: null }),
}));

let seq = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;
