"use client";

import { Send, Square, Command } from "lucide-react";
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
  "Summarize my most recent notes",
  "Explain the code I uploaded",
  "Define the main terms in chapter 2",
];

export function ChatInput({ onSend, isStreaming, onStop, disabled, placeholder }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    <div className="px-6 pb-8 pt-2">
      <div className="flex flex-wrap gap-2 mb-4 justify-center">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setValue(s)}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-[rgb(var(--border))] text-[rgb(var(--text-2))] hover:text-brand hover:border-brand/30 hover:bg-brand/5 transition-all"
            >
              {s}
            </button>
          ))}
      </div>

      <div className="relative group max-w-3xl mx-auto">
        {/* Glow effect */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-brand/20 to-brand/10 rounded-2xl blur opacity-20 group-focus-within:opacity-100 transition duration-1000"></div>
        
        <div className={cn(
          "relative flex items-end gap-2 rounded-2xl border p-4 transition-all duration-300",
          "bg-[rgb(var(--surface))] border-[rgb(var(--border))] shadow-xl shadow-black/5",
          "focus-within:border-brand/40 focus-within:ring-4 focus-within:ring-brand/5"
        )}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            disabled={disabled}
            placeholder={placeholder ?? "Query your knowledge base..."}
            className="flex-1 resize-none bg-transparent text-[14px] text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-2))] outline-none min-h-[24px] max-h-[200px] leading-relaxed custom-scroll"
          />

          <div className="flex items-center gap-2 pb-0.5">
            {isStreaming ? (
              <button
                onClick={onStop}
                className="w-8 h-8 rounded-xl bg-red-500 text-white hover:bg-red-600 flex items-center justify-center transition-all shadow-sm"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!value.trim() || disabled}
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center transition-all shadow-sm",
                  value.trim() && !disabled
                    ? "bg-brand text-white hover:bg-brand-hover hover:scale-105 active:scale-95"
                    : "bg-[rgb(var(--surface-2))] text-[rgb(var(--text-2))] opacity-40 cursor-not-allowed"
                )}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-center gap-4 mt-4 opacity-40">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[rgb(var(--text-2))]">
           <Command className="w-3 h-3" />
           <span>Return to Send</span>
        </div>
        <div className="w-1 h-1 rounded-full bg-[rgb(var(--text-2))]" />
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[rgb(var(--text-2))]">
           <span>RAG context</span>
        </div>
      </div>
    </div>
  );
}
