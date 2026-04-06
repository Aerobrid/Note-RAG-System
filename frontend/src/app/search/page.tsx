"use client";

import { useState, useTransition } from "react";
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
    { label: "All Sources", value: "all" },
    { label: "Documents", value: "documents" },
    { label: "Code", value: "code" },
  ];

  return (
    <div className="flex-1 flex flex-col relative bg-surface h-full overflow-hidden">
      {/* Top Bar (Minimalist) */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-outline-variant/10 bg-surface/40 backdrop-blur-md z-10 shrink-0">
        <div>
           <span className="font-manrope text-xs font-semibold text-on-surface-variant uppercase tracking-[0.2em]">Workspace</span>
           <span className="mx-2 text-on-surface-variant/50">/</span>
           <span className="font-manrope text-xs font-semibold text-primary">Knowledge Engine</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-8 lg:px-12 py-12 custom-scrollbar">
        <div className="max-w-[1000px] w-full mx-auto relative z-10">
          
          {/* Header Section */}
          <div className="mb-12 cursor-default animate-in fade-in duration-500 fly-in-from-bottom-2">
            <h2 className="text-[3rem] font-bold text-on-surface leading-tight tracking-tighter mb-4">Semantic Search</h2>
            <p className="text-on-surface-variant text-lg max-w-xl">
               Execute high-precision vector queries across your entire indexed database.
            </p>
          </div>

          {/* Search Interface */}
          <div className="animate-in fade-in duration-700 fly-in-from-bottom-4">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-outline group-focus-within:text-primary transition-colors">search</span>
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Enter a conceptual inquiry..."
                  className="w-full bg-surface-container-low border-2 border-outline-variant/30 text-on-surface text-sm rounded-xl pl-12 pr-12 py-4 outline-none focus:border-primary/50 focus:bg-surface-container-high transition-all shadow-lg shadow-black/5"
                />
                {isPending && (
                  <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none">
                     <span className="material-symbols-outlined text-primary animate-spin">refresh</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleSearch}
                disabled={!query.trim() || isPending}
                className={cn(
                  "px-8 py-4 rounded-xl font-bold text-sm tracking-widest uppercase transition-all shadow-lg flex items-center justify-center min-w-[160px]",
                  query.trim() && !isPending
                    ? "bg-primary text-on-primary hover:bg-primary-dim hover:scale-[1.02] active:scale-95 shadow-primary/20"
                    : "bg-surface-container-highest text-on-surface-variant opacity-50 cursor-not-allowed"
                )}
              >
                Execute
              </button>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="material-symbols-outlined text-sm text-outline mr-1">filter_list</span>
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setCollection(f.value)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-[11px] font-bold tracking-widest uppercase transition-colors border",
                    collection === f.value
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-surface-container border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Results Area */}
          <div className="mt-10 space-y-4 animate-in fade-in duration-1000 fly-in-from-bottom-6">
            {searched && results.length === 0 && !isPending && (
              <div className="text-center py-20 bg-surface-container-low border border-dashed border-outline-variant/30 rounded-2xl">
                <span className="material-symbols-outlined text-5xl text-outline mb-4">search_off</span>
                <p className="text-sm font-bold tracking-widest text-on-surface-variant uppercase">No Results Found</p>
                <p className="text-xs text-outline mt-2">Adjust your search query or upload more files.</p>
              </div>
            )}

            {results.map((r, i) => (
              <div
                key={i}
                className="border border-outline-variant/10 rounded-xl overflow-hidden bg-surface-container-low transition-all hover:border-primary/20 shadow-lg shadow-black/5"
              >
                {/* Result header */}
                <button
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-surface-container-high transition-colors text-left group"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  {r.doc_type === "code" ? (
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>code</span>
                  ) : (
                    <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate group-hover:text-primary transition-colors">{r.filename}</p>
                    <p className="text-xs text-on-surface-variant truncate mt-1 max-w-2xl font-light">
                      {r.text.slice(0, 140)}...
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 pl-4">
                    {r.language && (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-surface-container-highest text-primary font-mono tracking-widest uppercase border border-primary/10">
                        {r.language}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5" title="Retrieval Confidence Score">
                       <span className="material-symbols-outlined text-[14px] text-primary">radar</span>
                       <span className="text-xs font-bold text-on-surface font-mono">
                         {(r.score * 100).toFixed(0)}%
                       </span>
                    </div>
                  </div>
                </button>

                {/* Expanded text */}
                {expanded === i && (
                  <div className="px-6 pb-6 border-t border-outline-variant/10 bg-surface/50">
                    <pre className={cn(
                      "mt-6 text-[13px] leading-relaxed whitespace-pre-wrap rounded-xl p-6 border border-outline-variant/5 shadow-inner",
                      r.doc_type === "code"
                        ? "bg-[#000000] text-primary-fixed font-mono"
                        : "bg-surface-container-highest text-on-surface"
                    )}>
                      {r.text}
                    </pre>
                    <div className="mt-4 flex items-center gap-2 text-[10px] text-outline font-mono uppercase tracking-widest">
                       <span className="material-symbols-outlined text-[14px]">link</span>
                       <span className="truncate">{r.source}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Background Decorative Element (The "Mist") */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[120px]"></div>
          <div className="absolute top-[40%] -right-[10%] w-[50%] h-[50%] bg-secondary/5 rounded-full blur-[120px]"></div>
        </div>
      </main>
    </div>
  );
}
