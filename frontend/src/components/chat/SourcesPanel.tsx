"use client";

import { FileText, Code2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { Source } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

interface Props {
  sources: Source[];
  query_type?: string;
}

export function SourcesPanel({ sources, query_type }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!sources.length) return null;

  const shown = expanded ? sources : sources.slice(0, 3);

  return (
    <div className="mt-3 border border-[rgb(var(--border))] rounded-xl overflow-hidden text-xs">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-[rgb(var(--surface-2))] text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))] transition-colors"
      >
        <span className="font-medium">
          {sources.length} source{sources.length !== 1 ? "s" : ""} referenced
        </span>
        {query_type && (
          <span
            className={cn(
              "ml-auto px-2 py-0.5 rounded-full font-mono text-[10px]",
              query_type === "code"
                ? "bg-purple-500/10 text-purple-400"
                : query_type === "hybrid"
                ? "bg-amber-500/10 text-amber-400"
                : "bg-brand-600/10 text-brand-400"
            )}
          >
            {query_type}
          </span>
        )}
        {expanded ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
      </button>

      <div className="divide-y divide-[rgb(var(--border))]">
        {shown.map((src) => (
          <div key={src.index} className="flex items-center gap-2 px-3 py-2 bg-[rgb(var(--surface))]">
            <span className="text-[rgb(var(--text-2))] shrink-0">[{src.index}]</span>
            {src.doc_type === "code" ? (
              <Code2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-brand-400 shrink-0" />
            )}
            <span className="truncate text-[rgb(var(--text))]">{src.filename}</span>
            <span className="ml-auto text-[rgb(var(--text-2))] shrink-0">
              {(src.score * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
