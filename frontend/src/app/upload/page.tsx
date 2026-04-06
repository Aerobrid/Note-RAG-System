"use client";

import React, { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { uploadFiles, clearIndex, getStats } from "@/lib/api";
import { cn } from "@/lib/utils";

type FileStatus = "pending" | "uploading" | "done" | "error";

interface FileEntry {
  file: File;
  status: FileStatus;
  error?: string;
}

const ACCEPTED = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "text/plain": [".txt", ".md"],
  "text/x-python": [".py"],
  "text/javascript": [".js", ".ts", ".jsx", ".tsx"],
  "text/x-java-source": [".java"],
  "text/x-c": [".c", ".cpp", ".h"],
  "application/json": [".json", ".ipynb"],
};

const CODE_EXTS = new Set([
  ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".c", ".cpp", ".h", 
  ".cs", ".go", ".rs", ".rb", ".php", ".swift", ".kt", ".sql", ".sh", 
  ".r", ".m", ".ipynb", ".json"
]);

function isCodeFile(filename: string) {
  const ext = "." + filename.split(".").pop()!.toLowerCase();
  return CODE_EXTS.has(ext);
}

export default function UploadPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [purgeDialogStatus, setPurgeDialogStatus] = useState<"hidden" | "confirm" | "success" | "error">("hidden");
  const [purgeError, setPurgeError] = useState("");
  
  const [stats, setStats] = useState({ documents: 0, code: 0 });

  const fetchStats = async () => {
    try {
      const dbStats = await getStats();
      if (!dbStats.error) {
        setStats({ documents: dbStats.documents || 0, code: dbStats.code || 0 });
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const onDrop = useCallback((accepted: File[]) => {
    const entries: FileEntry[] = accepted.map((f) => ({ file: f, status: "pending" }));
    setFiles((prev) => [...prev, ...entries]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: true,
  });

  const removeFile = (index: number) => {
    if (uploading) return;
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    const pending = files.filter((f) => f.status === "pending" || f.status === "error");
    if (!pending.length) return;

    setUploading(true);
    setFiles((prev) =>
      prev.map((f) => (f.status === "pending" || f.status === "error" ? { ...f, status: "uploading", error: undefined } : f))
    );

    try {
      const result = await uploadFiles(pending.map((f) => f.file));
      setFiles((prev) =>
        prev.map((entry) => {
          const r = result.results.find((r: any) => r.file === entry.file.name);
          if (!r) return entry;
          return { ...entry, status: r.error ? "error" : "done", error: r.error };
        })
      );
      await fetchStats(); // Refresh DB stats after successful upload
    } catch (e: any) {
      setFiles((prev) =>
        prev.map((f) => (f.status === "uploading" ? { ...f, status: "error", error: e.message } : f))
      );
    } finally {
      setUploading(false);
    }
  };

  const removeDone = () => setFiles((prev) => prev.filter((f) => f.status !== "done"));
  
  const triggerPurge = () => setPurgeDialogStatus("confirm");

  const executePurge = async () => {
    setUploading(true);
    try {
      await clearIndex();
      setFiles([]);
      setPurgeDialogStatus("success");
      await fetchStats();
    } catch (err: any) {
      setPurgeError(err.message);
      setPurgeDialogStatus("error");
    } finally {
      setUploading(false);
    }
  };

  const pendingCount = files.filter((f) => f.status === "pending" || f.status === "error").length;
  
  // Quick graphical math for DB stats (cap at 10k or 100% just for visual flair)
  const docPercent = Math.min((stats.documents / 1000) * 100, 100).toFixed(0) + "%";
  const codePercent = Math.min((stats.code / 1000) * 100, 100).toFixed(0) + "%";

  return (
    <div className="flex-1 flex flex-col relative bg-surface h-full overflow-y-auto custom-scrollbar">
      {/* Top Bar (Minimalist) */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-outline-variant/10 bg-surface/40 backdrop-blur-md z-10 shrink-0">
        <div>
           <span className="font-manrope text-xs font-semibold text-on-surface-variant uppercase tracking-[0.2em]">Workspace</span>
           <span className="mx-2 text-on-surface-variant/50">/</span>
           <span className="font-manrope text-xs font-semibold text-primary">Knowledge Engine</span>
        </div>
      </header>

      {/* Canvas */}
      <div className="flex-1 px-8 lg:px-12 py-12 max-w-[1400px] w-full mx-auto">
        {/* Header Section */}
        <div className="mb-12 cursor-default">
          <h2 className="text-[3rem] font-bold text-on-surface leading-tight tracking-tighter mb-4 animate-in fade-in duration-500 fly-in-from-bottom-2">Ingest Knowledge</h2>
          <p className="text-on-surface-variant text-lg max-w-xl animate-in fade-in duration-700 fly-in-from-bottom-4">
              Add documents to your RAG workspace. Files will be parsed and indexed for immediate querying.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Upload Zone & Queue List */}
          <div className="col-span-1 md:col-span-12 xl:col-span-8 flex flex-col gap-6">
            <div 
              {...getRootProps()}
              className={cn(
                "relative group cursor-pointer animate-in fade-in duration-1000 fly-in-from-bottom-6",
                uploading ? "pointer-events-none opacity-50" : ""
              )}
            >
              <input {...getInputProps()} />
              <div className="absolute inset-0 bg-primary/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className={cn(
                "border-2 border-dashed rounded-xl p-20 flex flex-col items-center justify-center text-center transition-all",
                isDragActive ? "border-primary bg-primary/10" : "border-outline-variant/30 bg-surface-container-low group-hover:border-primary/50"
              )}>
                <span className={cn("material-symbols-outlined text-5xl mb-4 transition-colors", isDragActive ? "text-primary" : "text-on-surface-variant")}>
                    cloud_upload
                </span>
                <h3 className="text-xl font-semibold text-on-surface mb-2">Drop files to upload</h3>
                <p className="text-on-surface-variant text-sm">Or click to browse your local system</p>
                <p className="text-xs text-outline mt-6 uppercase tracking-widest font-bold">PDF, TXT, MD, DOCX, Code</p>
              </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between mb-6">
                   <div className="flex items-center gap-3">
                     <h4 className="text-sm font-bold text-on-surface uppercase tracking-widest">Active Queue</h4>
                     <span className="text-xs font-mono bg-surface-container-high px-2 py-0.5 rounded text-primary">{files.length}</span>
                   </div>
                   <div className="flex gap-4 items-center">
                     {files.some(f => f.status === "done") && (
                        <button onClick={removeDone} className="text-[11px] font-bold text-on-surface-variant hover:text-primary transition-colors tracking-widest uppercase">
                          Clear Completed
                        </button>
                     )}
                     {pendingCount > 0 && (
                        <button 
                          onClick={handleUpload}
                          disabled={uploading}
                          className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary font-bold text-xs uppercase tracking-widest rounded-lg hover:shadow-[0_0_20px_rgba(163,207,206,0.3)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                        >
                          {uploading ? "Indexing..." : "Upload Pending"}
                        </button>
                     )}
                   </div>
                </div>

                <div className="space-y-2">
                  {files.map((entry, i) => (
                    <div key={`${entry.file.name}-${i}`} className="flex items-center justify-between p-4 bg-surface-container-high rounded-lg group hover:bg-surface-container-highest transition-colors border border-transparent hover:border-outline-variant/10">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <span className={cn("material-symbols-outlined shrink-0", isCodeFile(entry.file.name) ? "text-primary/70" : "text-outline")}>
                          {isCodeFile(entry.file.name) ? "code" : "description"}
                        </span>
                        <div className="truncate">
                          <div className="text-sm font-medium text-on-surface truncate pr-4">{entry.file.name}</div>
                          <div className="text-[10px] text-on-surface-variant uppercase tracking-tighter flex gap-2 items-center">
                              {(entry.file.size / 1024 / 1024).toFixed(2)} MB
                              {entry.error && <span className="text-error font-bold tracking-normal truncate">• {entry.error}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 pl-4">
                        {entry.status === "pending" && <span className="text-[11px] font-mono text-secondary-dim italic">Pending</span>}
                        {entry.status === "uploading" && <span className="text-[11px] font-mono text-primary animate-pulse">Parsing...</span>}
                        {entry.status === "done" && <span className="text-[11px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">Indexed</span>}
                        
                        {(entry.status === "pending" || entry.status === "error") && (
                           <button onClick={() => removeFile(i)} className="text-outline hover:text-error transition-colors p-1" disabled={uploading}>
                             <span className="material-symbols-outlined text-sm">close</span>
                           </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Contextual Info / Stats Columns */}
          <div className="col-span-1 md:col-span-12 xl:col-span-4 space-y-6 flex flex-col h-full animate-in fade-in duration-1000 fly-in-from-bottom-[50px]">
             
             {/* Vector DB Stats */}
             <div className="bg-surface-container-low p-6 rounded-xl border-l-2 border-primary/40 shadow-xl shadow-black/10">
                <h5 className="text-xs font-bold text-primary uppercase tracking-widest mb-6">Database Stats</h5>
                
                <div className="space-y-5">
                   <div className="group">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-bold text-on-surface-variant">Document chunks</span>
                        <span className="text-xs text-on-surface font-mono">{stats.documents.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-surface-container-highest h-[3px] overflow-hidden rounded-full transition-all group-hover:h-[4px]">
                         <div className="bg-primary h-full transition-all duration-1000" style={{ width: docPercent }}></div>
                      </div>
                   </div>

                   <div className="group">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-bold text-on-surface-variant">Code chunks</span>
                        <span className="text-xs text-on-surface font-mono">{stats.code.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-surface-container-highest h-[3px] overflow-hidden rounded-full transition-all group-hover:h-[4px]">
                         <div className="bg-secondary h-full transition-all duration-1000" style={{ width: codePercent }}></div>
                      </div>
                   </div>
                </div>

                {/* Flush DB Button */}
                <div className="mt-8 pt-6 border-t border-outline-variant/15">
                   <button 
                     onClick={triggerPurge} disabled={uploading}
                     className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-error/20 bg-error/5 text-error hover:bg-error/10 hover:border-error/40 transition-all text-xs font-bold uppercase tracking-widest group active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
                    >
                       <span className="material-symbols-outlined text-[18px] opacity-70 group-hover:opacity-100">database_off</span>
                       Flush Vector Database
                   </button>
                </div>
             </div>

             {/* Ingestion Rules */}
             <div className="bg-surface-container-low p-6 rounded-xl border border-transparent shadow-lg shadow-black/5">
                <h5 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">Ingestion Rules</h5>
                <ul className="text-[13px] text-on-surface-variant space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[15px] mt-0.5 text-primary">check_circle</span>
                    <span className="leading-snug">Continuous automatic text-chunking limits document context explosion.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[15px] mt-0.5 text-primary">check_circle</span>
                    <span className="leading-snug">Hardware-accelerated embedding models extract structural metadata.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[15px] mt-0.5 text-primary">check_circle</span>
                    <span className="leading-snug">Air-gapped operation ensures raw text bodies remain entirely local to this host.</span>
                  </li>
                </ul>
             </div>

          </div>
        </div>
      </div>

      {/* Atmospheric Purge Modal */}
      {purgeDialogStatus !== "hidden" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-lowest/70 backdrop-blur-md px-4 animate-in fade-in duration-200">
          <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            {purgeDialogStatus === "confirm" && (
              <>
                <div className="flex justify-center mb-6">
                  <div className="p-4 bg-error/10 text-error rounded-full border border-error/20">
                    <span className="material-symbols-outlined text-4xl">warning</span>
                  </div>
                </div>
                <h2 className="text-xl font-bold text-center mb-3 text-on-surface">Flush Master Database?</h2>
                <p className="text-center text-on-surface-variant mb-8 leading-relaxed text-sm">
                  This command issues a hard drop to the ChromaDB collections. All semantic vectors and uploaded entities will be permanently erased.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPurgeDialogStatus("hidden")}
                    className="flex-1 py-3 rounded-xl bg-surface-container-highest hover:bg-surface-container-high text-on-surface text-[13px] font-bold transition-all border border-outline-variant/10"
                  >
                    Abort
                  </button>
                  <button
                    onClick={executePurge}
                    className="flex-1 py-3 rounded-xl bg-error hover:bg-error-dim text-on-error text-[13px] font-bold transition-all shadow-lg shadow-error/20 flex items-center justify-center gap-2"
                  >
                    {uploading ? <span className="material-symbols-outlined text-sm animate-spin">refresh</span> : <span className="material-symbols-outlined text-sm">delete_forever</span>}
                    Confirm Drop
                  </button>
                </div>
              </>
            )}
            {purgeDialogStatus === "success" && (
              <>
                <div className="flex justify-center mb-6">
                  <div className="p-4 bg-primary/10 text-primary rounded-full border border-primary/20">
                    <span className="material-symbols-outlined text-4xl">check_circle</span>
                  </div>
                </div>
                <h2 className="text-xl font-bold text-center mb-3 text-on-surface">Indexes Flushed</h2>
                <p className="text-center text-on-surface-variant mb-8 leading-relaxed text-sm">
                  System embeddings have been successfully unlinked and purged from local storage.
                </p>
                <button
                  onClick={() => setPurgeDialogStatus("hidden")}
                  className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-[13px] font-bold transition-all shadow-lg"
                >
                  Return to Active State
                </button>
              </>
            )}
            {purgeDialogStatus === "error" && (
              <>
                <div className="flex justify-center mb-6">
                  <div className="p-4 bg-error/10 text-error rounded-full border border-error/20">
                    <span className="material-symbols-outlined text-4xl">error</span>
                  </div>
                </div>
                <h2 className="text-xl font-bold text-center mb-3 text-error">Flush Terminated</h2>
                <p className="text-center text-on-surface-variant mb-8 leading-relaxed text-sm">
                  {purgeError || "I/O lock prevented dropping collections. Check backend terminal."}
                </p>
                <button
                  onClick={() => setPurgeDialogStatus("hidden")}
                  className="w-full py-3 rounded-xl bg-surface-container-highest hover:bg-surface-container-high text-on-surface border border-outline-variant/10 text-[13px] font-bold transition-all"
                >
                  Acknowledge
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
