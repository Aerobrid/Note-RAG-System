"use client";

import { useState, useTransition } from "react";
import { Search, FileText, Code2, Loader2, Filter } from "lucide-react";
import { search } from "@/lib/api";
import { cn } from "@/lib/utils";

type Collection = "all" | "documents" | "code";

interface Result {
  text: string;
  filename: string;
  source: string;
  doc_type: string;
  language: string;
  score: number;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState<Collection>("all");
  const [results, setResults] = useState<Result[]>([]);
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<number | null>(null);

  const handleSearch = () => {
    if (!query.trim()) return;
    startTransition(async () => {
      try {
        const data = await search(query, collection, 15);
        setResults(data.results ?? []);
        setSearched(true);
        setExpanded(null);
      } catch {
        setResults([]);
        setSearched(true);
      }
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const FILTERS: { label: string; value: Collection }[] = [
    { label: "All", value: "all" },
    { label: "Notes", value: "documents" },
    { label: "Code", value: "code" },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Search Notes</h1>
        <p className="text-sm text-[rgb(var(--text-2))] mt-1">
          Semantic search across all your indexed files. Finds meaning, not just keywords.
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] focus-within:border-brand-600/60 transition-colors">
          <Search className="w-4 h-4 text-[rgb(var(--text-2))] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search your notes..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[rgb(var(--text-2))]"
          />
          {isPending && <Loader2 className="w-4 h-4 animate-spin text-[rgb(var(--text-2))]" />}
        </div>
        <button
          onClick={handleSearch}
          disabled={!query.trim() || isPending}
          className={cn(
            "px-5 py-2.5 rounded-xl text-sm font-medium transition-colors",
            query.trim() && !isPending
              ? "bg-brand-600 text-white hover:bg-brand-700"
              : "bg-[rgb(var(--surface-2))] text-[rgb(var(--text-2))] cursor-not-allowed"
          )}
        >
          Search
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mt-3">
        <Filter className="w-3.5 h-3.5 text-[rgb(var(--text-2))]" />
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setCollection(f.value)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors",
              collection === f.value
                ? "bg-brand-600 text-white"
                : "border border-[rgb(var(--border))] text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))]"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="mt-6 space-y-3">
        {searched && results.length === 0 && !isPending && (
          <div className="text-center py-12 text-[rgb(var(--text-2))]">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No results found. Try a different query or upload more files.</p>
          </div>
        )}

        {results.map((r, i) => (
          <div
            key={i}
            className="border border-[rgb(var(--border))] rounded-xl overflow-hidden bg-[rgb(var(--surface))]"
          >
            {/* Result header */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[rgb(var(--surface-2))] transition-colors text-left"
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              {r.doc_type === "code" ? (
                <Code2 className="w-4 h-4 text-purple-400 shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-brand-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.filename}</p>
                <p className="text-xs text-[rgb(var(--text-2))] truncate mt-0.5">
                  {r.text.slice(0, 100)}...
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r.language && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-mono">
                    {r.language}
                  </span>
                )}
                <span className="text-xs text-[rgb(var(--text-2))]">
                  {(r.score * 100).toFixed(0)}%
                </span>
              </div>
            </button>

            {/* Expanded text */}
            {expanded === i && (
              <div className="px-4 pb-4 border-t border-[rgb(var(--border))]">
                <pre className={cn(
                  "mt-3 text-xs leading-6 whitespace-pre-wrap rounded-xl p-4",
                  r.doc_type === "code"
                    ? "bg-[#0d1117] text-gray-300 font-mono"
                    : "bg-[rgb(var(--surface-2))] text-[rgb(var(--text))]"
                )}>
                  {r.text}
                </pre>
                <p className="mt-2 text-[10px] text-[rgb(var(--text-2))] font-mono truncate">{r.source}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
