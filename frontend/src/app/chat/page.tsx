"use client";

import { useEffect, useRef, useCallback, useState } from "react";
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

  useEffect(() => {
    if (!activeSessionId && sessions.length === 0) {
      const id = createSession();
      setActiveSession(id);
    } else if (!activeSessionId && sessions.length > 0) {
      setActiveSession(sessions[0].id);
    }
  }, []);

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
    <div className="flex-1 flex flex-col relative bg-surface h-full overflow-hidden">
      {/* Top Bar (Minimalist) */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-outline-variant/10 bg-surface/40 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-on-surface-variant tracking-wider uppercase">Current Session:</span>
          <h2 className="text-sm font-semibold text-primary truncate max-w-sm">
             {session.title}
          </h2>
        </div>
        <div className="flex items-center gap-6">
          <button 
           onClick={() => { const id = createSession(); setActiveSession(id); }}
           className="text-on-surface-variant flex items-center gap-2 hover:text-primary transition-colors text-sm font-bold"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New
          </button>
        </div>
      </header>

      {/* Chat Interface Canvas */}
      <section className="flex-1 overflow-y-auto px-6 py-12 flex flex-col items-center custom-scrollbar">
        <div className="w-full max-w-4xl space-y-12">
          {session.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[40px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>water</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-on-surface">Atmospheric RAG Active</h2>
                <p className="text-sm text-on-surface-variant max-w-md mx-auto leading-relaxed">
                  Query across securely indexed documents, source code, and telemetry context.
                </p>
              </div>
            </div>
          )}
          
          {session.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          <div ref={bottomRef} className="h-4" />
        </div>
      </section>

      {/* Input Anchor */}
      <footer className="px-8 pb-8 pt-4 shrink-0 border-t border-outline-variant/10 bg-surface/90 backdrop-blur-sm">
        <ChatInput
          onSend={sendMessage}
          isStreaming={isStreaming}
          onStop={stopStreaming}
        />
      </footer>
    </div>
  );
}
