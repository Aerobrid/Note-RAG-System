"use client";

import { useEffect, useRef, useCallback } from "react";
import { Sparkles, Plus, BookOpen, MessageSquare } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { streamChat } from "@/lib/api";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { cn } from "@/lib/utils";

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

    addMessage(activeSessionId, { role: "user", content: query });

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

  if (!session) return null;

  return (
    <div className="flex flex-col h-full bg-[rgb(var(--bg))] relative overflow-hidden">
      {/* Centered Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 glass">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand/10 rounded-lg">
            <MessageSquare className="w-4 h-4 text-brand" />
          </div>
          <h1 className="text-[14px] font-bold tracking-tight truncate max-w-[200px] md:max-w-md">
            {session.title === "New chat" ? "Conversation" : session.title}
          </h1>
        </div>
        <button
          onClick={() => { const id = createSession(); setActiveSession(id); }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand-hover transition-all shadow-sm shadow-brand/10"
        >
          <Plus className="w-3.5 h-3.5" /> New chat
        </button>
      </header>

      {/* Messages area - centered content constraint */}
      <div className="flex-1 overflow-y-auto custom-scroll px-4">
        <div className="max-w-3xl mx-auto py-12 space-y-10">
          {session.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-brand/5 flex items-center justify-center animate-pulse">
                <Sparkles className="w-10 h-10 text-brand" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">How can ScholarMind help today?</h2>
                <p className="text-sm text-[rgb(var(--text-2))] max-w-sm mx-auto leading-relaxed">
                  I'm grounded in your private documents. Ask me anything about your notes, research, or code.
                </p>
              </div>
              <div className="flex gap-2">
                 <div className="px-4 py-2 bg-[rgb(var(--surface-2))] rounded-2xl border border-[rgb(var(--border))] text-[12px] font-medium text-[rgb(var(--text-2))]">
                    PDF Analysis
                 </div>
                 <div className="px-4 py-2 bg-[rgb(var(--surface-2))] rounded-2xl border border-[rgb(var(--border))] text-[12px] font-medium text-[rgb(var(--text-2))]">
                    Code Explanation
                 </div>
              </div>
            </div>
          )}
          
          {session.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          <div ref={bottomRef} className="h-4" />
        </div>
      </div>

      {/* Input area - floaty centered look */}
      <div className="w-full max-w-4xl mx-auto">
        <ChatInput
          onSend={sendMessage}
          isStreaming={isStreaming}
          onStop={stopStreaming}
        />
      </div>
    </div>
  );
}
