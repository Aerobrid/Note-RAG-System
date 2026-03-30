"use client";

import { useEffect, useState } from "react";
import { Settings, Database, Cpu, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { getHealth, getStats } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

interface HealthData {
  status: string;
  llm_provider: string;
  stats: { documents: number; code: number };
}

export default function SettingsPage() {
  const { llmProvider, setLlmProvider } = useAppStore();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    const data = await getHealth();
    setHealth(data);
    if (data.llm_provider) setLlmProvider(data.llm_provider as "gemini" | "ollama");
    setLoading(false);
  };

  useEffect(() => { fetchHealth(); }, []);

  const PROVIDERS = [
    {
      id: "gemini",
      label: "Gemini Pro",
      desc: "Google's API — free tier for students. Fast, cloud-based. Requires API key.",
      badge: "Free",
      badgeColor: "bg-green-500/10 text-green-400",
    },
    {
      id: "ollama",
      label: "Ollama (Local)",
      desc: "Runs entirely on your NVIDIA GPU. No API key, no internet, full privacy.",
      badge: "Private",
      badgeColor: "bg-purple-500/10 text-purple-400",
    },
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto w-full">
      <div className="mb-6 flex items-center gap-3">
        <Settings className="w-5 h-5 text-[rgb(var(--text-2))]" />
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      {/* Backend status */}
      <section className="mb-6">
        <h2 className="text-sm font-medium mb-3 text-[rgb(var(--text-2))] uppercase tracking-wider">System Status</h2>
        <div className="border border-[rgb(var(--border))] rounded-2xl p-4 bg-[rgb(var(--surface))] flex items-center gap-3">
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin text-[rgb(var(--text-2))]" />
          ) : health?.status === "ok" ? (
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium">
              {loading ? "Connecting..." : health?.status === "ok" ? "Backend online" : "Backend offline"}
            </p>
            <p className="text-xs text-[rgb(var(--text-2))]">http://localhost:8000</p>
          </div>
          <button onClick={fetchHealth} className="text-xs text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))] flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </section>

      {/* Vector store stats */}
      <section className="mb-6">
        <h2 className="text-sm font-medium mb-3 text-[rgb(var(--text-2))] uppercase tracking-wider">Knowledge Base</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Note chunks", value: health?.stats?.documents ?? 0, icon: Database, color: "text-brand-400" },
            { label: "Code chunks", value: health?.stats?.code ?? 0, icon: Cpu, color: "text-purple-400" },
          ].map((stat) => (
            <div key={stat.label} className="border border-[rgb(var(--border))] rounded-2xl p-4 bg-[rgb(var(--surface))]">
              <stat.icon className={cn("w-5 h-5 mb-2", stat.color)} />
              <p className="text-2xl font-semibold">{stat.value.toLocaleString()}</p>
              <p className="text-xs text-[rgb(var(--text-2))] mt-0.5">{stat.label} indexed</p>
            </div>
          ))}
        </div>
      </section>

      {/* LLM Provider */}
      <section className="mb-6">
        <h2 className="text-sm font-medium mb-1 text-[rgb(var(--text-2))] uppercase tracking-wider">LLM Provider</h2>
        <p className="text-xs text-[rgb(var(--text-2))] mb-3">
          Switch in <code className="font-mono text-brand-400">.env</code> → restart backend. This view reflects the current active provider.
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
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full",
                  health?.llm_provider === p.id ? "bg-green-400" : "bg-[rgb(var(--border))]"
                )} />
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

      {/* Env config reference */}
      <section>
        <h2 className="text-sm font-medium mb-3 text-[rgb(var(--text-2))] uppercase tracking-wider">Key Configuration</h2>
        <div className="border border-[rgb(var(--border))] rounded-2xl p-4 bg-[rgb(var(--surface))] font-mono text-xs space-y-1.5 text-[rgb(var(--text-2))]">
          {[
            ["LLM_PROVIDER", "gemini | ollama"],
            ["GEMINI_API_KEY", "from aistudio.google.com"],
            ["OLLAMA_MODEL", "llama3.2:3b"],
            ["OLLAMA_CODE_MODEL", "qwen2.5-coder:7b"],
            ["EMBED_MODEL", "BAAI/bge-large-en-v1.5"],
            ["NOTES_DIR", "./notes  ← drop files here"],
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
