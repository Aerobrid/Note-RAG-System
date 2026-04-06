"use client";
import React from "react";

import { Message } from "@/store/useAppStore";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { SourcesPanel } from "./SourcesPanel";
import { User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  message: Message;
}

export const MessageBubble = React.memo(function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300")}>
      <div className={cn("flex gap-5", isUser ? "flex-row-reverse" : "flex-row")}>
        {/* Avatar */}
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
            isUser 
              ? "bg-[rgb(var(--surface-2))] text-[rgb(var(--text-2))]" 
              : "bg-brand text-white"
          )}
        >
          {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
        </div>

        {/* Content */}
        <div className={cn("flex-1 space-y-3 min-w-0 mt-1", isUser ? "text-right" : "text-left")}>
          <div
            className={cn(
              "inline-block text-[15px] leading-relaxed",
              isUser ? "text-[rgb(var(--text))] font-medium" : "text-[rgb(var(--text))]"
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="prose-rag-system max-w-none">
                <MarkdownRenderer content={message.content} />
                {message.isStreaming && (
                  <span className="inline-block w-1.5 h-4 bg-brand/40 animate-pulse ml-1" />
                )}
              </div>
            )}
          </div>

          {/* Metadata/Sources */}
          {!isUser && !message.isStreaming && message.sources && message.sources.length > 0 && (
             <div className="pt-2">
                <SourcesPanel sources={message.sources} />
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
