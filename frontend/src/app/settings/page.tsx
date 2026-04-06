"use client";

import { useCallback, useEffect, useState } from "react";
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
      if (h.llm_provider) setLlmProvider(h.llm_provider as "cloud" | "ollama");
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
      id: "cloud",
      label: "Cloud Provider",
      desc: "Remote API. Map CLOUD_API_KEY and CLOUD_MODEL in environments.",
      badge: "API",
      badgeColor: "bg-primary-container text-primary font-bold border border-primary/20",
    },
    {
      id: "ollama",
      label: "Local Engine",
      desc: "Local inference. Requires OLLAMA_BASE_URL mapped to internal host.",
      badge: "Local",
      badgeColor: "bg-surface-container-highest text-secondary border border-secondary/20",
    },
  ];

  return (
    <div className="flex-1 flex flex-col relative bg-surface h-full overflow-hidden">
      {/* Top Bar */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-outline-variant/10 bg-surface/40 backdrop-blur-md z-10 shrink-0">
        <div>
           <span className="font-manrope text-xs font-semibold text-on-surface-variant uppercase tracking-[0.2em]">Workspace</span>
           <span className="mx-2 text-on-surface-variant/50">/</span>
           <span className="font-manrope text-xs font-semibold text-primary">Settings</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-8 lg:px-12 py-12 custom-scrollbar">
        <div className="max-w-[800px] w-full mx-auto relative z-10">
          
          {/* Page Header */}
          <div className="mb-12 animate-in fade-in duration-500 fly-in-from-bottom-2">
            <h2 className="text-[3rem] font-extrabold font-headline leading-tight tracking-tight text-on-surface mb-2">Global Settings</h2>
            <p className="text-on-surface-variant text-lg font-light">
              Manage backend health, active LLM provider, and vector database stats.
            </p>
          </div>

          <div className="space-y-8 animate-in fade-in duration-700 fly-in-from-bottom-4">
            
            {/* Backend Telemetry Section */}
            <section>
              <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-on-surface-variant mb-4 ml-2">Backend Status</h3>
              <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-6 shadow-lg shadow-black/5 flex items-center gap-6">
                <div className="shrink-0 w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center border border-outline-variant/10 relative">
                  {loading ? (
                    <span className="material-symbols-outlined text-primary animate-spin text-3xl">refresh</span>
                  ) : health?.status === "ok" ? (
                    <>
                      <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-50" />
                      <span className="material-symbols-outlined text-primary text-3xl z-10" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
                    </>
                  ) : (
                    <span className="material-symbols-outlined text-error text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-on-surface uppercase tracking-widest mb-1 shadow-sm">
                    {loading ? "Checking Backend..." : health?.status === "ok" ? "Backend Reachable" : "Backend Offline"}
                  </h4>
                  <p className="text-xs text-on-surface-variant font-mono truncate mb-2">
                    {backendLabel}
                  </p>
                  
                  {latencyMs != null && !loading && health?.status === "ok" && (
                    <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-primary/80">
                      <span className="material-symbols-outlined text-[14px]">timer</span>
                      RTT Latency: {latencyMs}ms
                    </div>
                  )}

                  {/* LLM Sub-status blocks */}
                  {!loading && health?.llm_provider === "ollama" && health.ollama && (
                    <div className={cn(
                        "mt-4 p-3 rounded-xl border text-[11px] font-mono leading-relaxed",
                        health.ollama.reachable ? "bg-primary/5 border-primary/20 text-primary" : "bg-error/5 border-error/20 text-error"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1 uppercase font-bold tracking-widest">
                         <span className="material-symbols-outlined text-[14px]">memory</span> Local LLM Engine
                      </div>
                      {health.ollama.reachable
                        ? `Connected. Operating with ${health.ollama.models_installed ?? 0} physical models.`
                        : `CRITICAL: Engine unreachable. Validate Internal Host mappings.`}
                    </div>
                  )}

                  {!loading && health?.llm_provider === "cloud" && (
                    <div className={cn(
                        "mt-4 p-3 rounded-xl border text-[11px] font-mono leading-relaxed",
                        health.cloud_configured ? "bg-primary/5 border-primary/20 text-primary" : "bg-error/5 border-error/20 text-error"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1 uppercase font-bold tracking-widest">
                         <span className="material-symbols-outlined text-[14px]">cloud</span> Cloud Inference
                      </div>
                      {health.cloud_configured ? "API Key validated and loaded into memory." : "CRITICAL: Cloud Token Missing. Modify env vars."}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => refresh()}
                  className="px-4 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-primary flex items-center justify-center self-stretch h-16 shrink-0"
                  title="Refresh Status"
                >
                  <span className="material-symbols-outlined">sync</span>
                </button>
              </div>
            </section>

            {/* Vector DB Stats Bento */}
            <section className="animate-in fade-in duration-1000 fly-in-from-bottom-6">
              <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-on-surface-variant mb-4 ml-2">Vector Database</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Document chunks", value: stats?.documents ?? 0, icon: "description", color: "text-secondary" },
                  { label: "Code chunks", value: stats?.code ?? 0, icon: "code", color: "text-primary" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-6 shadow-lg shadow-black/5 hover:border-primary/20 transition-colors group">
                    <div className="flex justify-between items-start mb-6">
                       <span className={cn("material-symbols-outlined text-3xl opacity-80 group-hover:opacity-100 transition-opacity", stat.color)} style={{ fontVariationSettings: "'FILL' 1" }}>{stat.icon}</span>
                    </div>
                    <p className="text-[2.5rem] font-bold text-on-surface mb-1 font-mono tracking-tighter">
                      {statsLoading ? "—" : stat.value.toLocaleString()}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">{stat.label}</p>
                  </div>
                ))}
              </div>
              {stats?.error && (
                <div className="mt-3 p-3 bg-error/10 border border-error/20 rounded-xl flex items-center gap-3 text-error text-xs font-mono">
                  <span className="material-symbols-outlined">warning</span> {stats.error}
                </div>
              )}
            </section>

            {/* Default LLM Selection */}
            <section className="animate-in fade-in duration-1000 fly-in-from-bottom-8">
              <div className="flex items-center justify-between mb-4 ml-2 flex-wrap gap-2">
                 <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-on-surface-variant">LLM Provider</h3>
                 <p className="text-[10px] text-on-surface-variant/80 font-mono italic">
                   Controlled by <span className="text-primary opacity-80 bg-primary/10 px-1 rounded">LLM_PROVIDER</span> in .env. Restart API after changing.
                 </p>
              </div>
              
              <div className="space-y-4">
                {PROVIDERS.map((p) => (
                  <div
                    key={p.id}
                    className={cn(
                      "rounded-2xl p-6 bg-surface-container-low transition-all border shadow-lg",
                      health?.llm_provider === p.id
                        ? "border-primary shadow-primary/5"
                        : "border-outline-variant/10 shadow-black/5 opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-4 mb-2">
                      <div className={cn("w-3 h-3 rounded-full shadow-inner", health?.llm_provider === p.id ? "bg-primary animate-pulse shadow-primary" : "bg-surface-container-highest")} />
                      <span className="text-sm font-bold text-on-surface uppercase tracking-widest">{p.label}</span>
                      <span className={cn("ml-auto text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest", p.badgeColor)}>
                        {p.badge}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant ml-7 font-light">{p.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Environmental Config */}
            <section className="animate-in fade-in duration-1000 fly-in-from-bottom-8">
              <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-on-surface-variant mb-4 ml-2">Environment Variables</h3>
              <div className="bg-surface-container-high border border-transparent shadow-inner rounded-2xl p-6 font-mono text-[11px] space-y-3 text-on-surface-variant">
                {[
                  ["LLM_PROVIDER", "cloud | ollama"],
                  ["CLOUD_API_KEY", "your provider API key"],
                  ["CLOUD_MODEL", "your provider model ID"],
                  ["OLLAMA_BASE_URL", "http://host.docker.internal:11434"],
                  ["NOTES_DIR", "./notes"],
                  ["CHROMA_PATH", "./chroma_db"],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-4 border-b border-outline-variant/10 pb-3 last:border-0 last:pb-0 px-2 hover:bg-surface-container-highest/50 transition-colors rounded">
                    <span className="text-primary tracking-widest font-bold min-w-[140px] shrink-0">{k}</span>
                    <span className="text-outline shrink-0">=</span>
                    <span className="text-on-surface opacity-80 break-words">{v}</span>
                  </div>
                ))}
              </div>
            </section>

          </div>
        </div>

        {/* Background Decorative Element */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[140px]"></div>
          <div className="absolute top-[10%] -left-[20%] w-[50%] h-[50%] bg-secondary/5 rounded-full blur-[120px]"></div>
        </div>
      </main>
    </div>
  );
}
