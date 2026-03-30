"use client";

import { Send, Square, Paperclip } from "lucide-react";
import { useRef, useEffect, useState, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

interface Props {
  onSend: (message: string) => void;
  isStreaming: boolean;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

const SUGGESTIONS = [
  "Explain the key concepts from today's lecture",
  "Find all code examples related to binary trees",
  "Summarize my notes on neural networks",
  "What algorithms did I study for dynamic programming?",
];

export function ChatInput({ onSend, isStreaming, onStop, disabled, placeholder }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="px-4 pb-4 pt-2">
      {/* Suggestion chips — only shown when input is empty */}
      {!value && (
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setValue(s)}
              className="text-xs px-3 py-1.5 rounded-full border border-[rgb(var(--border))] text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))] hover:border-brand-600/40 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input box */}
      <div className={cn(
        "flex items-end gap-2 rounded-2xl border p-3 transition-colors",
        "bg-[rgb(var(--surface))] border-[rgb(var(--border))]",
        "focus-within:border-brand-600/60"
      )}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          disabled={disabled}
          placeholder={placeholder ?? "Ask anything about your notes..."}
          className="flex-1 resize-none bg-transparent text-sm text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-2))] outline-none min-h-[24px] max-h-[200px] leading-6"
        />

        <div className="flex items-center gap-1.5">
          {isStreaming ? (
            <button
              onClick={onStop}
              className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-red-400" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!value.trim() || disabled}
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                value.trim() && !disabled
                  ? "bg-brand-600 text-white hover:bg-brand-700"
                  : "bg-[rgb(var(--surface-2))] text-[rgb(var(--text-2))] cursor-not-allowed"
              )}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <p className="text-center text-[10px] text-[rgb(var(--text-2))] mt-2">
        Shift+Enter for new line · answers grounded in your notes only
      </p>
    </div>
  );
}
