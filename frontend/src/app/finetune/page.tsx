"use client";

import { useState, useEffect, useRef } from "react";
import { Cpu, Database, Play, CheckCircle2, XCircle, Loader2, ChevronRight, Info } from "lucide-react";
import { generateDataset, startTraining, getFinetuneStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

interface JobStatus {
  status: "idle" | "running" | "done" | "error";
  phase?: "dataset" | "training";
  progress?: number;
  message?: string;
  result?: Record<string, unknown>;
}

export default function FinetunePage() {
  const [status, setStatus] = useState<JobStatus>({ status: "idle" });
  const [nPairs, setNPairs] = useState(3);
  const [maxChunks, setMaxChunks] = useState(300);
  const [epochs, setEpochs] = useState(3);
  const [batchSize, setBatchSize] = useState(4);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll status while a job is running
  useEffect(() => {
    if (status.status === "running") {
      pollRef.current = setInterval(async () => {
        const s = await getFinetuneStatus();
        setStatus(s);
        if (s.status !== "running") clearInterval(pollRef.current!);
      }, 2000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status.status]);

  const handleGenerate = async () => {
    setStatus({ status: "running", phase: "dataset", progress: 0, message: "Starting..." });
    await generateDataset(nPairs, maxChunks);
    // actual status comes from polling
  };

  const handleTrain = async () => {
    setStatus({ status: "running", phase: "training", progress: 0, message: "Starting..." });
    await startTraining(epochs, batchSize);
  };

  const STEPS = [
    { id: "index",   label: "Index your notes",       desc: "Upload files or drop them in /notes/",        done: true },
    { id: "dataset", label: "Generate Q&A dataset",   desc: "LLM creates training pairs from your notes",  done: status.phase === "training" || (status.status === "done" && status.phase === "dataset") },
    { id: "train",   label: "LoRA fine-tuning",       desc: "Unsloth training on dataset", done: status.status === "done" && status.phase === "training" },
    { id: "deploy",  label: "Deploy via Ollama",      desc: "Merge adapter → run your custom model",       done: false },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Fine-tune on Your Notes</h1>
        <p className="text-sm text-[rgb(var(--text-2))] mt-1">
          Train a small LLM (Llama 3.2 3B) on your own notes using QLoRA.
        </p>
      </div>

      {/* Pipeline steps */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
        {STEPS.map((step, i) => (
          <div key={step.id} className="flex items-center gap-1 shrink-0">
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium",
              step.done
                ? "bg-green-500/10 text-green-400"
                : "bg-[rgb(var(--surface-2))] text-[rgb(var(--text-2))]"
            )}>
              {step.done
                ? <CheckCircle2 className="w-3.5 h-3.5" />
                : <div className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[9px]">{i+1}</div>
              }
              {step.label}
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-[rgb(var(--text-2))]" />}
          </div>
        ))}
      </div>

      {/* GPU Warning */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-6 text-xs">
        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-amber-300">
          <strong>GPU required for training.</strong> Dataset generation uses your LLM API (Gemini/Ollama) and works on any machine.
          Training requires CUDA. You need at least 6 GB VRAM. For 8 GB VRAM, set batch size to 2.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Step 1: Generate Dataset */}
        <div className="border border-[rgb(var(--border))] rounded-2xl p-5 bg-[rgb(var(--surface))]">
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-4 h-4 text-brand-400" />
            <h2 className="text-sm font-semibold">Step 1 — Generate Dataset</h2>
          </div>
          <p className="text-xs text-[rgb(var(--text-2))] mb-4">
            Uses Gemini/Ollama to create Q&amp;A pairs from your indexed notes. Creates{" "}
            <code className="font-mono text-brand-400">finetune_data.jsonl</code>.
          </p>

          <div className="space-y-3 mb-4">
            <label className="block">
              <span className="text-xs text-[rgb(var(--text-2))]">Q&amp;A pairs per chunk: <strong className="text-[rgb(var(--text))]">{nPairs}</strong></span>
              <input type="range" min={1} max={5} value={nPairs} onChange={(e) => setNPairs(+e.target.value)}
                className="w-full mt-1 accent-brand-600" />
            </label>
            <label className="block">
              <span className="text-xs text-[rgb(var(--text-2))]">Max chunks: <strong className="text-[rgb(var(--text))]">{maxChunks}</strong></span>
              <input type="range" min={50} max={1000} step={50} value={maxChunks} onChange={(e) => setMaxChunks(+e.target.value)}
                className="w-full mt-1 accent-brand-600" />
            </label>
          </div>

          <button
            onClick={handleGenerate}
            disabled={status.status === "running"}
            className={cn(
              "w-full py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2",
              status.status !== "running"
                ? "bg-brand-600 text-white hover:bg-brand-700"
                : "bg-[rgb(var(--surface-2))] text-[rgb(var(--text-2))] cursor-not-allowed"
            )}
          >
            {status.status === "running" && status.phase === "dataset"
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              : <><Play className="w-4 h-4" /> Generate Dataset</>}
          </button>
        </div>

        {/* Step 2: Train */}
        <div className="border border-[rgb(var(--border))] rounded-2xl p-5 bg-[rgb(var(--surface))]">
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold">Step 2 — Train LoRA</h2>
          </div>
          <p className="text-xs text-[rgb(var(--text-2))] mb-4">
            Fine-tunes <code className="font-mono text-purple-400">Llama-3.2-3B</code> with QLoRA on your dataset.
            2× faster than HuggingFace Trainer thanks to Unsloth.
          </p>

          <div className="space-y-3 mb-4">
            <label className="block">
              <span className="text-xs text-[rgb(var(--text-2))]">Epochs: <strong className="text-[rgb(var(--text))]">{epochs}</strong></span>
              <input type="range" min={1} max={10} value={epochs} onChange={(e) => setEpochs(+e.target.value)}
                className="w-full mt-1 accent-purple-600" />
            </label>
            <label className="block">
              <span className="text-xs text-[rgb(var(--text-2))]">Batch size: <strong className="text-[rgb(var(--text))]">{batchSize}</strong></span>
              <input type="range" min={1} max={8} value={batchSize} onChange={(e) => setBatchSize(+e.target.value)}
                className="w-full mt-1 accent-purple-600" />
            </label>
          </div>

          <button
            onClick={handleTrain}
            disabled={status.status === "running"}
            className={cn(
              "w-full py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2",
              status.status !== "running"
                ? "bg-purple-600 text-white hover:bg-purple-700"
                : "bg-[rgb(var(--surface-2))] text-[rgb(var(--text-2))] cursor-not-allowed"
            )}
          >
            {status.status === "running" && status.phase === "training"
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Training...</>
              : <><Cpu className="w-4 h-4" /> Start Training</>}
          </button>
        </div>
      </div>

      {/* Progress / status */}
      {status.status !== "idle" && (
        <div className={cn(
          "mt-4 p-4 rounded-xl border text-sm",
          status.status === "error"
            ? "border-red-500/30 bg-red-500/10 text-red-400"
            : status.status === "done"
            ? "border-green-500/30 bg-green-500/10 text-green-400"
            : "border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] text-[rgb(var(--text))]"
        )}>
          <div className="flex items-center gap-2 mb-2">
            {status.status === "running" && <Loader2 className="w-4 h-4 animate-spin" />}
            {status.status === "done"  && <CheckCircle2 className="w-4 h-4" />}
            {status.status === "error" && <XCircle className="w-4 h-4" />}
            <span className="font-medium capitalize">{status.status}</span>
            {status.progress !== undefined && status.status === "running" && (
              <span className="ml-auto text-xs text-[rgb(var(--text-2))]">{status.progress}%</span>
            )}
          </div>
          {status.status === "running" && status.progress !== undefined && (
            <div className="w-full h-1.5 bg-[rgb(var(--border))] rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-brand-600 rounded-full transition-all"
                style={{ width: `${status.progress}%` }}
              />
            </div>
          )}
          {status.message && <p className="text-xs text-[rgb(var(--text-2))]">{status.message}</p>}
          {status.result && (
            <pre className="mt-2 text-xs font-mono bg-[rgb(var(--surface))] rounded-lg p-3 overflow-x-auto">
              {JSON.stringify(status.result, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* After-training instructions */}
      {status.status === "done" && status.phase === "training" && (
        <div className="mt-4 p-4 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-xs space-y-2">
          <p className="font-semibold text-sm">Training complete! Deploy your model:</p>
          <div className="font-mono bg-[rgb(var(--surface-2))] rounded-lg p-3 space-y-1 text-[rgb(var(--text-2))]">
            <p className="text-[rgb(var(--text))]"># 1. Merge LoRA adapter into base model</p>
            <p>python backend/scripts/merge_and_export.py</p>
            <p className="mt-2 text-[rgb(var(--text))]"># 2. Create Ollama model</p>
            <p>ollama create rag-system -f ./finetuned_model/Modelfile</p>
            <p className="mt-2 text-[rgb(var(--text))]"># 3. Switch to your fine-tuned model</p>
            <p>{"# In .env: LLM_PROVIDER=ollama  OLLAMA_MODEL=rag-system"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
