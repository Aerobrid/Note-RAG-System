"use client";

import { useCallback, useEffect, useState } from "react";
import { Settings, Database, Cpu, RefreshCw, CheckCircle2, AlertCircle, Timer } from "lucide-react";
import { getHealth, getStats, getBackendDisplayLabel, type HealthPayload } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { setLlmProvider } = useAppStore();
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [stats, setStats] = useState<{ documents: number; code: number; error?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const backendLabel = getBackendDisplayLabel();

  const refresh = useCallback(() => {
    setLoading(true);
    setStatsLoading(true);

    const t0 = typeof performance !== "undefined" ? performance.now() : 0;
    void getHealth().then((h) => {
      setHealth(h);
      if (h.llm_provider) setLlmProvider(h.llm_provider as "gemini" | "ollama");
      if (t0) setLatencyMs(Math.round(performance.now() - t0));
      setLoading(false);
    });

    void getStats().then((s) => {
      setStats(s);
      setStatsLoading(false);
    });
  }, [setLlmProvider]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const PROVIDERS = [
    {
      id: "gemini",
      label: "Gemini",
      desc: "Cloud API. Set GEMINI_API_KEY in .env.",
      badge: "API",
      badgeColor: "bg-green-500/10 text-green-400",
    },
    {
      id: "ollama",
      label: "Ollama",
      desc: "Local inference. Set OLLAMA_BASE_URL and models in .env.",
      badge: "Local",
      badgeColor: "bg-purple-500/10 text-purple-400",
    },
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto w-full">
      <div className="mb-6 flex items-center gap-3">
        <Settings className="w-5 h-5 text-[rgb(var(--text-2))]" />
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      <section className="mb-6">
        <h2 className="text-sm font-medium mb-3 text-[rgb(var(--text-2))] uppercase tracking-wider">Backend</h2>
        <div className="border border-[rgb(var(--border))] rounded-2xl p-4 bg-[rgb(var(--surface))] flex items-center gap-3">
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin text-[rgb(var(--text-2))]" />
          ) : health?.status === "ok" ? (
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {loading ? "Checking…" : health?.status === "ok" ? "Reachable" : "Unreachable"}
            </p>
            <p className="text-xs text-[rgb(var(--text-2))] truncate" title={backendLabel}>
              {backendLabel}
            </p>
            {latencyMs != null && !loading && health?.status === "ok" && (
              <p className="text-[10px] text-[rgb(var(--text-2))] mt-1 flex items-center gap-1">
                <Timer className="w-3 h-3" /> Health {latencyMs} ms
              </p>
            )}
            {!loading && health?.llm_provider === "ollama" && health.ollama && (
              <p
                className={cn(
                  "text-[10px] mt-1.5 leading-snug",
                  health.ollama.reachable ? "text-green-400/90" : "text-amber-500/90"
                )}
              >
                Ollama at <code className="font-mono text-[rgb(var(--text-2))]">OLLAMA_BASE_URL</code>:{" "}
                {health.ollama.reachable
                  ? `${health.ollama.models_installed ?? 0} model(s) installed`
                  : `not reachable — ${health.ollama.error ?? "check URL and that Ollama is running"}`}
              </p>
            )}
            {!loading && health?.llm_provider === "gemini" && (
              <p
                className={cn(
                  "text-[10px] mt-1.5",
                  health.gemini_configured ? "text-green-400/90" : "text-amber-500/90"
                )}
              >
                Gemini API key: {health.gemini_configured ? "loaded" : "missing — set GEMINI_API_KEY"}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="text-xs text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))] flex items-center gap-1 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-sm font-medium mb-3 text-[rgb(var(--text-2))] uppercase tracking-wider">Vector index</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Note chunks", value: stats?.documents ?? 0, icon: Database, color: "text-brand-400" },
            { label: "Code chunks", value: stats?.code ?? 0, icon: Cpu, color: "text-purple-400" },
          ].map((stat) => (
            <div key={stat.label} className="border border-[rgb(var(--border))] rounded-2xl p-4 bg-[rgb(var(--surface))]">
              <stat.icon className={cn("w-5 h-5 mb-2", stat.color)} />
              <p className="text-2xl font-semibold">
                {statsLoading ? "…" : stat.value.toLocaleString()}
              </p>
              <p className="text-xs text-[rgb(var(--text-2))] mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
        {stats?.error && (
          <p className="text-xs text-amber-500/90 mt-2">{stats.error}</p>
        )}
      </section>

      <section className="mb-6">
        <h2 className="text-sm font-medium mb-1 text-[rgb(var(--text-2))] uppercase tracking-wider">LLM</h2>
        <p className="text-xs text-[rgb(var(--text-2))] mb-3">
          Active provider comes from the backend <code className="font-mono text-brand-400">LLM_PROVIDER</code>. Restart the API after changing <code className="font-mono text-brand-400">.env</code>.
        </p>
        <div className="space-y-3">
          {PROVIDERS.map((p) => (
            <div
              key={p.id}
              className={cn(
                "border rounded-2xl p-4 bg-[rgb(var(--surface))] transition-colors",
                health?.llm_provider === p.id
                  ? "border-brand-600/60"
                  : "border-[rgb(var(--border))]"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    health?.llm_provider === p.id ? "bg-green-400" : "bg-[rgb(var(--border))]"
                  )}
                />
                <span className="text-sm font-medium">{p.label}</span>
                <span className={cn("ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium", p.badgeColor)}>
                  {p.badge}
                </span>
              </div>
              <p className="text-xs text-[rgb(var(--text-2))] ml-[18px]">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium mb-3 text-[rgb(var(--text-2))] uppercase tracking-wider">Environment</h2>
        <div className="border border-[rgb(var(--border))] rounded-2xl p-4 bg-[rgb(var(--surface))] font-mono text-xs space-y-1.5 text-[rgb(var(--text-2))]">
          {[
            ["LLM_PROVIDER", "gemini | ollama"],
            ["GEMINI_API_KEY", "if using Gemini"],
            ["OLLAMA_BASE_URL", "http://localhost:11434"],
            ["NOTES_DIR", "./notes"],
            ["CHROMA_PATH", "./chroma_db"],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <span className="text-brand-400 shrink-0">{k}</span>
              <span>=</span>
              <span className="text-[rgb(var(--text))]">{v}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
