"use client";

import { useEffect, useRef, useCallback } from "react";
import { BookOpen, Plus } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { streamChat } from "@/lib/api";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";

export default function ChatPage() {
  const {
    sessions, activeSessionId, isStreaming,
    createSession, setActiveSession, addMessage, updateMessage, setStreaming, getActiveSession,
  } = useAppStore();

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<boolean>(false);

  const session = getActiveSession();

  // Auto-create session on first load
  useEffect(() => {
    if (!activeSessionId && sessions.length === 0) {
      const id = createSession();
      setActiveSession(id);
    } else if (!activeSessionId && sessions.length > 0) {
      setActiveSession(sessions[0].id);
    }
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages]);

  const sendMessage = useCallback(async (query: string) => {
    if (!activeSessionId || isStreaming) return;

    // Add user message
    addMessage(activeSessionId, { role: "user", content: query });

    // Add placeholder assistant message
    const assistantId = addMessage(activeSessionId, {
      role: "assistant",
      content: "",
      isStreaming: true,
    });

    setStreaming(true);
    abortRef.current = false;

    let fullContent = "";
    let sources: any[] = [];
    let query_type = "qa";

    try {
      const history = (session?.messages ?? [])
        .filter((m) => !m.isStreaming && m.content)
        .map((m) => ({ role: m.role, content: m.content }));

      for await (const chunk of streamChat(query, history)) {
        if (abortRef.current) break;

        if (chunk.type === "meta") {
          sources = chunk.sources ?? [];
          query_type = chunk.query_type ?? "qa";
        } else if (chunk.type === "token") {
          fullContent += chunk.content ?? "";
          updateMessage(activeSessionId, assistantId, {
            content: fullContent,
            isStreaming: true,
          });
        } else if (chunk.type === "done") {
          break;
        }
      }
    } catch (err) {
      fullContent = "Sorry, I encountered an error. Please check that the backend is running.";
    }

    updateMessage(activeSessionId, assistantId, {
      content: fullContent || "No response received.",
      isStreaming: false,
      sources,
      query_type,
    });
    setStreaming(false);
  }, [activeSessionId, isStreaming, session]);

  const stopStreaming = () => {
    abortRef.current = true;
    setStreaming(false);
  };

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center text-[rgb(var(--text-2))]">
        <div className="text-center space-y-4">
          <BookOpen className="w-12 h-12 mx-auto opacity-30" />
          <p className="text-sm">No active session.</p>
          <button
            onClick={() => { const id = createSession(); setActiveSession(id); }}
            className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl bg-brand-600 text-white text-sm hover:bg-brand-700"
          >
            <Plus className="w-4 h-4" /> New Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[rgb(var(--border))]">
        <h1 className="text-sm font-semibold truncate">{session.title}</h1>
        <button
          onClick={() => { const id = createSession(); setActiveSession(id); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto custom-scroll px-6 py-6 space-y-6">
        {session.messages.length === 0 && (
          <div className="text-center py-16 text-[rgb(var(--text-2))]">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Ask anything about your notes</p>
            <p className="text-xs mt-1">Upload files first if you haven't already.</p>
          </div>
        )}
        {session.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        isStreaming={isStreaming}
        onStop={stopStreaming}
      />
    </div>
  );
}
