"use client";

import { useState, useEffect, useRef } from "react";
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
    setStatus({ status: "running", phase: "dataset", progress: 0, message: "Booting data pipeline..." });
    await generateDataset(nPairs, maxChunks);
  };

  const handleTrain = async () => {
    setStatus({ status: "running", phase: "training", progress: 0, message: "Allocating CUDA..." });
    await startTraining(epochs, batchSize);
  };

  const STEPS = [
    { id: "index",   label: "Vectorize DB",         desc: "Upload files", done: true },
    { id: "dataset", label: "Generate Dataset",     desc: "LLM pairs",    done: status.phase === "training" || (status.status === "done" && status.phase === "dataset") },
    { id: "train",   label: "Train LoRA",           desc: "Unsloth LoRA", done: status.status === "done" && status.phase === "training" },
    { id: "deploy",  label: "Deploy Model",         desc: "Merge Modelfile", done: false },
  ];

  return (
    <div className="flex-1 flex flex-col relative bg-surface h-full overflow-hidden">
      {/* Top Bar */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-outline-variant/10 bg-surface/40 backdrop-blur-md z-10 shrink-0">
        <div>
           <span className="font-manrope text-xs font-semibold text-on-surface-variant uppercase tracking-[0.2em]">Workspace</span>
           <span className="mx-2 text-on-surface-variant/50">/</span>
           <span className="font-manrope text-xs font-semibold text-primary">Fine-tune</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-8 lg:px-12 py-12 custom-scrollbar">
        <div className="max-w-[1000px] w-full mx-auto relative z-10">
          
          {/* Header */}
          <div className="mb-12 animate-in fade-in duration-500 fly-in-from-bottom-2">
            <h2 className="text-[3rem] font-extrabold font-headline leading-tight tracking-tight text-on-surface mb-2">LoRA Fine-tuning</h2>
            <p className="text-on-surface-variant text-lg font-light max-w-2xl">
              Construct high-fidelity knowledge pipelines. Train local models dynamically using your locally vectorized intel.
            </p>
          </div>

          {/* Pipeline Nodes */}
          <div className="flex items-center gap-2 mb-10 overflow-x-auto pb-4 custom-scrollbar animate-in fade-in duration-700 fly-in-from-bottom-4">
            {STEPS.map((step, i) => (
              <div key={step.id} className="flex items-center gap-2 shrink-0 group">
                <div className={cn(
                  "flex items-center gap-3 px-5 py-3 rounded-2xl text-[11px] font-bold uppercase tracking-widest transition-all",
                  step.done
                    ? "bg-primary-container/30 text-primary border border-primary/20 shadow-lg shadow-primary/5"
                    : "bg-surface-container-low text-on-surface-variant border border-outline-variant/10"
                )}>
                  {step.done
                    ? <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    : <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[9px] opacity-60">{i+1}</div>
                  }
                  <div className="flex items-baseline gap-2">
                     {step.label}
                     <span className="opacity-40 text-[9px] font-mono lowercase tracking-normal hidden md:inline-block md:ml-1">{step.desc}</span>
                  </div>
                </div>
                {i < STEPS.length - 1 && <span className="material-symbols-outlined text-[14px] text-outline opacity-50 px-2 lg:px-4">arrow_forward_ios</span>}
              </div>
            ))}
          </div>

          {/* Warning Card */}
          <div className="flex items-start gap-4 p-5 rounded-2xl bg-surface-container-high border-l-2 border-secondary mb-10 text-xs shadow-lg animate-in fade-in duration-700 fly-in-from-bottom-6">
            <span className="material-symbols-outlined text-secondary shrink-0 mt-0.5">developer_board</span>
            <div className="text-on-surface-variant leading-relaxed">
              <strong className="text-on-surface tracking-widest uppercase">Hardware Requirements: </strong> 
              Dataset generation pipelines operate entirely natively via local or cloud APIs. The actual fine-tuning neural pass specifically requires <strong className="text-primary tracking-widest font-mono">CUDA</strong> activation. Minimum 6GB VRAM threshold required.
            </div>
          </div>

          {/* Split Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-1000 fly-in-from-bottom-8">
            
            {/* Step 1 */}
            <div className="border border-outline-variant/10 rounded-3xl p-8 bg-surface-container-low shadow-xl flex flex-col hover:border-primary/20 transition-colors">
              <div className="flex items-center gap-3 mb-4 border-b border-outline-variant/10 pb-4">
                <span className="material-symbols-outlined text-3xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>database</span>
                <div>
                   <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface shadow-sm">Generate Dataset</h2>
                   <p className="text-[10px] text-on-surface-variant tracking-widest uppercase opacity-70">Preparation</p>
                </div>
              </div>
              <p className="text-xs text-on-surface-variant mb-6 font-light leading-relaxed">
                Utilize your active model to scrape and formulate Q&A logical arrays from vectorized notes into <code className="font-mono text-primary bg-primary/5 px-1 rounded">finetune_data.jsonl</code>.
              </p>

              <div className="space-y-6 mb-8 mt-auto">
                <label className="block">
                  <div className="flex justify-between items-end mb-2">
                     <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Q&A Pairs</span>
                     <strong className="text-on-surface font-mono text-xs">{nPairs} Pairs</strong>
                  </div>
                  <input type="range" min={1} max={5} value={nPairs} onChange={(e) => setNPairs(+e.target.value)}
                    className="w-full h-1.5 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary" />
                </label>
                <label className="block">
                  <div className="flex justify-between items-end mb-2">
                     <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Max Chunks</span>
                     <strong className="text-on-surface font-mono text-xs">{maxChunks} Chunks</strong>
                  </div>
                  <input type="range" min={50} max={1000} step={50} value={maxChunks} onChange={(e) => setMaxChunks(+e.target.value)}
                    className="w-full h-1.5 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary" />
                </label>
              </div>

              <button
                onClick={handleGenerate}
                disabled={status.status === "running"}
                className={cn(
                  "w-full py-4 rounded-xl text-xs font-bold tracking-widest transition-all flex items-center justify-center gap-3 uppercase",
                  status.status !== "running"
                    ? "bg-primary text-on-primary hover:bg-primary-dim hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-primary/20"
                    : "bg-surface-container-highest text-on-surface-variant opacity-50 cursor-not-allowed"
                )}
              >
                {status.status === "running" && status.phase === "dataset"
                  ? <><span className="material-symbols-outlined text-[16px] animate-spin">refresh</span> Generating Dataset...</>
                  : <><span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span> Generate Dataset</>}
              </button>
            </div>

            {/* Step 2 */}
            <div className="border border-outline-variant/10 rounded-3xl p-8 bg-surface-container-low shadow-xl flex flex-col hover:border-secondary/30 transition-colors">
              <div className="flex items-center gap-3 mb-4 border-b border-outline-variant/10 pb-4">
                <span className="material-symbols-outlined text-3xl text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>memory</span>
                <div>
                   <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface shadow-sm">LoRA Training</h2>
                   <p className="text-[10px] text-on-surface-variant tracking-widest uppercase opacity-70">Training</p>
                </div>
              </div>
              <p className="text-xs text-on-surface-variant mb-6 font-light leading-relaxed">
                Fine-tunes base architecture using QLoRA logic over generated matrices. Highly concurrent Unsloth optimization enabled inherently.
              </p>

              <div className="space-y-6 mb-8 mt-auto">
                <label className="block">
                  <div className="flex justify-between items-end mb-2">
                     <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Epochs</span>
                     <strong className="text-on-surface font-mono text-xs">{epochs} Epochs</strong>
                  </div>
                  <input type="range" min={1} max={10} value={epochs} onChange={(e) => setEpochs(+e.target.value)}
                    className="w-full h-1.5 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-secondary" />
                </label>
                <label className="block">
                  <div className="flex justify-between items-end mb-2">
                     <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Batch Size</span>
                     <strong className="text-on-surface font-mono text-xs">{batchSize} Size</strong>
                  </div>
                  <input type="range" min={1} max={8} value={batchSize} onChange={(e) => setBatchSize(+e.target.value)}
                    className="w-full h-1.5 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-secondary" />
                </label>
              </div>

              <button
                onClick={handleTrain}
                disabled={status.status === "running"}
                className={cn(
                  "w-full py-4 rounded-xl text-xs font-bold tracking-widest transition-all flex items-center justify-center gap-3 uppercase",
                  status.status !== "running"
                    ? "bg-secondary-container text-on-secondary-container border border-secondary/20 hover:bg-secondary hover:text-on-secondary hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-secondary/10"
                    : "bg-surface-container-highest text-on-surface-variant opacity-50 cursor-not-allowed"
                )}
              >
                {status.status === "running" && status.phase === "training"
                  ? <><span className="material-symbols-outlined text-[16px] animate-spin">refresh</span> Training...</>
                  : <><span className="material-symbols-outlined text-[16px]">bolt</span> Start Training</>}
              </button>
            </div>
          </div>

          {/* Operational Progress / Console */}
          {status.status !== "idle" && (
            <div className={cn(
              "mt-8 p-6 rounded-2xl border text-sm shadow-2xl animate-in slide-in-from-bottom-4 transition-all",
              status.status === "error"
                ? "border-error/30 bg-surface-container-low"
                : status.status === "done"
                ? "border-primary/40 bg-surface-container-low shadow-primary/5"
                : "border-secondary/20 bg-surface-container-low"
            )}>
              <div className="flex items-center gap-3 mb-4">
                {status.status === "running" && <span className="material-symbols-outlined text-secondary animate-spin">autorenew</span>}
                {status.status === "done"  && <span className="material-symbols-outlined text-primary">done_all</span>}
                {status.status === "error" && <span className="material-symbols-outlined text-error">gpp_bad</span>}
                
                <span className="font-bold tracking-widest uppercase text-xs text-on-surface">{status.phase} Pipeline: {status.status}</span>
                {status.progress !== undefined && status.status === "running" && (
                  <span className="ml-auto text-xs font-mono text-secondary font-bold">{status.progress}%</span>
                )}
              </div>

              {status.status === "running" && status.progress !== undefined && (
                <div className="w-full h-1 bg-surface-container-highest overflow-hidden mb-4 rounded-full">
                  <div
                    className="h-full bg-secondary shadow-[0_0_10px_#b9c7e0] transition-all duration-300"
                    style={{ width: `${status.progress}%` }}
                  />
                </div>
              )}
              
              {status.message && <p className="text-xs text-on-surface-variant font-mono mb-2"><span className="text-primary mr-2">&gt;</span>{status.message}</p>}
              
              {status.result && (
                <pre className="mt-4 text-[10px] font-mono bg-[#000000] text-primary-fixed rounded-xl p-4 overflow-x-auto border border-outline-variant/10 shadow-inner">
                  {JSON.stringify(status.result, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* After-training instructions */}
          {status.status === "done" && status.phase === "training" && (
            <div className="mt-8 p-6 rounded-2xl border border-primary/20 bg-surface-container-highest shadow-xl animate-in slide-in-from-bottom-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
              <h3 className="font-bold text-sm tracking-widest uppercase text-on-surface mb-4 flex items-center gap-2">
                 <span className="material-symbols-outlined text-primary">terminal</span> Training Complete
              </h3>
              <div className="font-mono bg-[black] text-primary rounded-xl p-5 space-y-4 text-[11px] leading-relaxed shadow-inner border border-outline-variant/10">
                <div>
                  <p className="text-outline mb-1"># 1. Merge LoRA adapter into base model</p>
                  <p className="opacity-90">python backend/scripts/merge_and_export.py</p>
                </div>
                <div>
                  <p className="text-outline mb-1"># 2. Create local Ollama model definition</p>
                  <p className="opacity-90">ollama create rag-system -f ./finetuned_model/Modelfile</p>
                </div>
                <div>
                  <p className="text-outline mb-1"># 3. Mount fine-tuned target into active memory</p>
                  <p className="opacity-90">{"# In .env: LLM_PROVIDER=ollama  OLLAMA_MODEL=rag-system"}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Background Decorative Element */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-[30%] left-[20%] w-[30%] h-[30%] bg-purple-500/10 rounded-full blur-[140px] mix-blend-screen"></div>
        </div>
      </main>
    </div>
  );
}
