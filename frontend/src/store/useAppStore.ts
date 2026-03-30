import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MessageRole = "user" | "assistant";

export interface Source {
  index: number;
  filename: string;
  source: string;
  doc_type: string;
  score: number;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  sources?: Source[];
  query_type?: string;
  isStreaming?: boolean;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

interface AppState {
  // Sessions
  sessions: ChatSession[];
  activeSessionId: string | null;

  // UI state
  isStreaming: boolean;
  sidebarOpen: boolean;

  // LLM provider (reflected from backend env)
  llmProvider: "gemini" | "ollama";

  // Actions
  createSession: () => string;
  setActiveSession: (id: string) => void;
  deleteSession: (id: string) => void;
  addMessage: (sessionId: string, message: Omit<Message, "id" | "timestamp">) => string;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void;
  setStreaming: (v: boolean) => void;
  setSidebarOpen: (v: boolean) => void;
  setLlmProvider: (v: "gemini" | "ollama") => void;
  getActiveSession: () => ChatSession | undefined;
  clearSession: (id: string) => void;
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      isStreaming: false,
      sidebarOpen: true,
      llmProvider: "gemini",

      createSession: () => {
        const id = generateId();
        const session: ChatSession = {
          id,
          title: "New chat",
          messages: [],
          createdAt: Date.now(),
        };
        set((s) => ({ sessions: [session, ...s.sessions], activeSessionId: id }));
        return id;
      },

      setActiveSession: (id) => set({ activeSessionId: id }),

      deleteSession: (id) =>
        set((s) => {
          const sessions = s.sessions.filter((s) => s.id !== id);
          return {
            sessions,
            activeSessionId:
              s.activeSessionId === id ? (sessions[0]?.id ?? null) : s.activeSessionId,
          };
        }),

      addMessage: (sessionId, message) => {
        const id = generateId();
        set((s) => ({
          sessions: s.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  title:
                    session.messages.length === 0 && message.role === "user"
                      ? message.content.slice(0, 50)
                      : session.title,
                  messages: [
                    ...session.messages,
                    { ...message, id, timestamp: Date.now() },
                  ],
                }
              : session
          ),
        }));
        return id;
      },

      updateMessage: (sessionId, messageId, updates) =>
        set((s) => ({
          sessions: s.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  messages: session.messages.map((m) =>
                    m.id === messageId ? { ...m, ...updates } : m
                  ),
                }
              : session
          ),
        })),

      setStreaming: (v) => set({ isStreaming: v }),
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      setLlmProvider: (v) => set({ llmProvider: v }),

      getActiveSession: () => {
        const { sessions, activeSessionId } = get();
        return sessions.find((s) => s.id === activeSessionId);
      },

      clearSession: (id) =>
        set((s) => ({
          sessions: s.sessions.map((session) =>
            session.id === id ? { ...session, messages: [] } : session
          ),
        })),
    }),
    {
      name: "rag-system-store",
      partialize: (state) => ({ sessions: state.sessions, activeSessionId: state.activeSessionId }),
    }
  )
);
