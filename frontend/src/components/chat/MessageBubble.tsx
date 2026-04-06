"use client";
import React from "react";

import { Message } from "@/store/useAppStore";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { SourcesPanel } from "./SourcesPanel";
import { cn } from "@/lib/utils";

interface Props {
  message: Message;
}

export const MessageBubble = React.memo(function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 group">
      <div className={cn("flex gap-6", isUser ? "flex-row-reverse" : "flex-row")}>
        {/* Avatar */}
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded flex items-center justify-center",
            isUser 
              ? "bg-surface-container-highest text-on-surface-variant" 
              : "bg-primary/20 text-primary"
          )}
        >
          {isUser ? (
            <span className="material-symbols-outlined text-sm">person</span>
          ) : (
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>water</span>
          )}
        </div>

        {/* Content */}
        <div className={cn("flex-1 flex min-w-0", isUser ? "justify-end" : "justify-start")}>
          <div
            className={cn(
              "px-6 py-4 border shadow-sm w-fit max-w-[90%]",
              isUser
                ? "bg-primary/5 rounded-2xl rounded-tr-none border-primary/10"
                : "bg-surface-container-low rounded-2xl rounded-tl-none border-outline-variant/5"
            )}
          >
            {isUser ? (
              <p className="leading-relaxed text-on-surface text-right whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="prose-rag-system max-w-none text-on-surface/90 leading-relaxed">
                <MarkdownRenderer content={message.content} />
                {message.isStreaming && (
                  <span className="inline-block w-1.5 h-4 bg-primary/40 animate-pulse ml-1" />
                )}
              </div>
            )}
            
            {/* Metadata/Sources */}
            {!isUser && !message.isStreaming && message.sources && message.sources.length > 0 && (
               <div className="pt-4 mt-2 border-t border-outline-variant/10">
                  <SourcesPanel sources={message.sources} />
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
