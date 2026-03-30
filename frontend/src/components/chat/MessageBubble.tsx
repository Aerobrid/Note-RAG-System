"use client";

import { Bot, User, Copy, Check } from "lucide-react";
import { useState } from "react";
import type { Message } from "@/store/useAppStore";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { SourcesPanel } from "./SourcesPanel";
import { cn } from "@/lib/utils";

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn("flex gap-3 group", isUser && "justify-end")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}

      <div className={cn("max-w-[80%] min-w-0", isUser && "items-end flex flex-col")}>
        {isUser ? (
          <div className="bg-brand-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
            {message.content}
          </div>
        ) : (
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl rounded-tl-sm px-4 py-3">
            <MarkdownRenderer
              content={message.content || " "}
              isStreaming={message.isStreaming}
            />
            {!message.isStreaming && message.sources && message.sources.length > 0 && (
              <SourcesPanel sources={message.sources} query_type={message.query_type} />
            )}
          </div>
        )}

        {/* Copy button */}
        {!message.isStreaming && (
          <button
            onClick={copy}
            className="mt-1 opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))] transition-all"
          >
            {copied ? (
              <><Check className="w-3 h-3" /> Copied</>
            ) : (
              <><Copy className="w-3 h-3" /> Copy</>
            )}
          </button>
        )}
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-lg bg-[rgb(var(--surface-2))] flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-4 h-4 text-[rgb(var(--text-2))]" />
        </div>
      )}
    </div>
  );
}
