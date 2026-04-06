"use client";

import { useRef, useEffect, useState, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

interface Props {
  onSend: (message: string) => void;
  isStreaming: boolean;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

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
    <div className="max-w-4xl mx-auto w-full">
      <div className="relative bg-surface-container-highest rounded-2xl border border-outline-variant/20 shadow-2xl transition-all focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          disabled={disabled}
          className="w-full bg-transparent border-none text-on-surface placeholder:text-on-surface-variant/40 focus:ring-0 p-6 pr-24 min-h-[100px] resize-none outline-none custom-scrollbar"
          placeholder={placeholder ?? "Type your query or command..."}
        />
        <div className="absolute bottom-4 right-4 flex items-center gap-3">
          {isStreaming ? (
            <button
              onClick={onStop}
              className="w-10 h-10 bg-error/90 text-on-error rounded-xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">stop</span>
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!value.trim() || disabled}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all",
                value.trim() && !disabled
                  ? "bg-primary text-on-primary shadow-primary/20 hover:scale-105 active:scale-95"
                  : "bg-surface-container-low text-on-surface-variant/40 cursor-not-allowed opacity-50"
              )}
            >
              <span className="material-symbols-outlined text-[20px]">send</span>
            </button>
          )}
        </div>
      </div>
      
      <div className="mt-3 flex items-center justify-center gap-6 text-[10px] text-on-surface-variant/40 uppercase font-bold tracking-widest">
        <span>RAG Engine 1.0</span>
        <span>•</span>
        <span>Local Index Active</span>
        <span>•</span>
        <span>Privacy: Isolated</span>
      </div>
    </div>
  );
}
