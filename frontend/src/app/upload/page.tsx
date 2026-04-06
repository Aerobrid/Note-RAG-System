"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, Code2, CheckCircle2, XCircle, Loader2, FolderOpen, Trash2, FilePlus, AlertCircle } from "lucide-react";
import { uploadFiles, clearIndex } from "@/lib/api";
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

const ICON_MAP: Record<string, React.ReactElement> = {
  ".pdf": <FileText className="w-5 h-5 text-red-500" />,
  ".docx": <FileText className="w-5 h-5 text-blue-500" />,
  ".pptx": <FileText className="w-5 h-5 text-orange-500" />,
  ".txt": <FileText className="w-5 h-5 text-gray-500" />,
  ".md": <FileText className="w-5 h-5 text-gray-400" />,
};

// Any code extension will automatically get a Code2 Logo
const CODE_EXTS = new Set([
  ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".c", ".cpp", ".h", 
  ".cs", ".go", ".rs", ".rb", ".php", ".swift", ".kt", ".sql", ".sh", 
  ".r", ".m", ".ipynb", ".json"
]);

function getIcon(filename: string) {
  const ext = "." + filename.split(".").pop()!.toLowerCase();
  
  if (CODE_EXTS.has(ext)) {
    return <Code2 className="w-5 h-5 text-yellow-500" />;
  }
  
  return ICON_MAP[ext] ?? <FileText className="w-5 h-5 text-[rgb(var(--text-2))]" />;
}

export default function UploadPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [purgeDialogStatus, setPurgeDialogStatus] = useState<"hidden" | "confirm" | "success" | "error">("hidden");
  const [purgeError, setPurgeError] = useState("");

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
    } catch (err: any) {
      setPurgeError(err.message);
      setPurgeDialogStatus("error");
    } finally {
      setUploading(false);
    }
  };

  const pendingCount = files.filter((f) => f.status === "pending" || f.status === "error").length;

  return (
    <div className="p-6 max-w-5xl mx-auto w-full min-h-screen flex flex-col bg-[rgb(var(--bg))]">
      <div className="mb-10 text-center md:text-left">
        <div className="flex items-center gap-2 mb-2 justify-center md:justify-start">
           <Upload className="w-5 h-5 text-brand" />
           <span className="text-[10px] font-semibold text-[rgb(var(--text-2))] uppercase tracking-[0.2em]">Upload</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Add files</h1>
        <p className="text-sm text-[rgb(var(--text-2))] max-w-xl leading-relaxed">
          PDF, PPTX, DOCX, text, and source files are chunked and embedded into the local vector index.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_350px] gap-10 flex-1 items-start">
        {/* Left: Drop zone & Info */}
        <div className="space-y-8">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-[2rem] p-16 flex flex-col items-center gap-6 cursor-pointer transition-all duration-300 group relative overflow-hidden",
              isDragActive
                ? "border-brand bg-brand/[0.03] scale-[1.01]"
                : "border-[rgb(var(--border))] hover:border-brand/40 hover:bg-[rgb(var(--surface-2))/30]"
            )}
          >
            <input {...getInputProps()} />
            
            <div className="w-20 h-20 rounded-3xl bg-brand/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner">
              <Upload className={cn("w-10 h-10", isDragActive ? "text-brand" : "text-brand/60")} />
            </div>
            
            <div className="text-center space-y-1">
              <p className="text-lg font-bold tracking-tight">
                {isDragActive ? "Drop to Begin" : "Add New Documents"}
              </p>
              <p className="text-[13px] text-[rgb(var(--text-2))]">
                Drag & drop or <span className="text-brand font-bold underline underline-offset-4 decoration-brand/30 hover:decoration-brand transition-all">browse your files</span>
              </p>
            </div>

            <div className="flex gap-4 opacity-30 mt-2">
               <FileText className="w-5 h-5" />
               <div className="w-px h-5 bg-[rgb(var(--border))]" />
               <Code2 className="w-5 h-5" />
               <div className="w-px h-5 bg-[rgb(var(--border))]" />
               <FilePlus className="w-5 h-5" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-[rgb(var(--surface-2))/40 rounded-2xl p-5 border border-[rgb(var(--border))]">
              <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center mb-3 text-brand">
                 <CheckCircle2 className="w-4 h-4" />
              </div>
              <h3 className="text-[13px] font-bold mb-1">Auto-Indexing</h3>
              <p className="text-[12px] text-[rgb(var(--text-2))] leading-relaxed">
                Files are chunked and embedded immediately after upload for real-time querying.
              </p>
            </div>
            
            <div className="bg-[rgb(var(--surface-2))/40 rounded-2xl p-5 border border-[rgb(var(--border))]">
              <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center mb-3 text-brand">
                 <FolderOpen className="w-4 h-4" />
              </div>
              <h3 className="text-[13px] font-bold mb-1">Direct Folder Sync</h3>
              <p className="text-[12px] text-[rgb(var(--text-2))] leading-relaxed">
                 Drop files into <code className="text-brand font-mono font-bold">./notes/</code> to skip the upload UI.
              </p>
            </div>
            
            <button
              onClick={triggerPurge}
              disabled={uploading}
              className="md:col-span-2 mt-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl p-4 border border-red-500/20 text-center font-bold text-[13px] flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Purge Database & Settings
            </button>
          </div>
        </div>

        {/* Right: File list & Actions */}
        <div className="flex flex-col border border-[rgb(var(--border))] rounded-[2rem] bg-[rgb(var(--surface))] overflow-hidden shadow-2xl shadow-black/[0.02]">
          <div className="p-6 border-b border-[rgb(var(--border))] flex items-center justify-between bg-[rgb(var(--surface-2))/20]">
            <h2 className="font-bold flex items-center gap-2 text-[14px]">
              Queue
              <span className="px-2 py-0.5 bg-brand text-white text-[10px] rounded-full font-bold">
                {files.length}
              </span>
            </h2>
            {files.some((f) => f.status === "done") && (
              <button
                onClick={removeDone}
                className="text-[11px] font-bold text-brand hover:underline"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[400px] custom-scroll divide-y divide-[rgb(var(--border))/50">
            {files.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[rgb(var(--surface-2))] flex items-center justify-center">
                  <FileText className="w-6 h-6 text-[rgb(var(--text-2))] opacity-40" />
                </div>
                <div className="space-y-1">
                   <p className="text-[13px] text-[rgb(var(--text))] font-bold">Queue is empty</p>
                   <p className="text-[11px] text-[rgb(var(--text-2))]">Selected files will appear here</p>
                </div>
              </div>
            ) : (
              files.map((entry, i) => (
                <div key={`${entry.file.name}-${i}`} className="group flex items-center gap-4 px-6 py-4 hover:bg-[rgb(var(--surface-2))/20] transition-colors">
                  <div className="shrink-0">{getIcon(entry.file.name)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold truncate text-[rgb(var(--text))]">{entry.file.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold text-[rgb(var(--text-2))] uppercase opacity-60">
                        {(entry.file.size / 1024).toFixed(0)} KB
                      </span>
                      {entry.error && (
                        <>
                          <div className="w-1 h-1 rounded-full bg-red-400" />
                          <span className="text-[10px] text-red-500 font-bold truncate">{entry.error}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {entry.status === "pending" && (
                      <button
                        onClick={() => removeFile(i)}
                        className="p-2 rounded-xl text-[rgb(var(--text-2))] hover:bg-red-50 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {entry.status === "uploading" && (
                      <Loader2 className="w-5 h-5 animate-spin text-brand" />
                    )}
                    {entry.status === "done" && (
                      <div className="p-1.5 bg-green-50 dark:bg-green-500/10 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </div>
                    )}
                    {entry.status === "error" && (
                      <button
                        onClick={() => removeFile(i)}
                        className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-6 bg-[rgb(var(--surface-2))/20 border-t border-[rgb(var(--border))]">
            <button
              onClick={handleUpload}
              disabled={uploading || pendingCount === 0}
              className={cn(
                "w-full py-3.5 rounded-2xl text-[14px] font-bold transition-all duration-300 flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]",
                pendingCount > 0 && !uploading
                  ? "bg-brand text-white shadow-brand/20 hover:bg-brand-hover"
                  : "bg-[rgb(var(--surface-2))] text-[rgb(var(--text-2))] opacity-50 cursor-not-allowed shadow-none"
              )}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Indexing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload {pendingCount} {pendingCount === 1 ? "Source" : "Sources"}
                </>
              )}
            </button>
            <p className="text-[10px] font-bold text-center text-[rgb(var(--text-2))] mt-4 uppercase tracking-widest opacity-40">
               Encrypted Local Indexing
            </p>
          </div>
        </div>
      </div>

      {/* Purge Modal */}
      {purgeDialogStatus !== "hidden" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {purgeDialogStatus === "confirm" && (
              <>
                <div className="flex justify-center mb-6">
                  <div className="p-4 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
                    <AlertCircle className="w-10 h-10" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-center mb-3">Are you sure?</h2>
                <p className="text-center text-[rgb(var(--text-2))] mb-8 leading-relaxed text-[13px]">
                  This will permanently wipe all uploaded files and index databases from the system. This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPurgeDialogStatus("hidden")}
                    className="flex-1 py-3.5 rounded-2xl bg-[rgb(var(--surface-2))] hover:bg-[rgb(var(--surface-2))/80] text-[14px] font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executePurge}
                    className="flex-1 py-3.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-[14px] font-bold transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Yes, Purge
                  </button>
                </div>
              </>
            )}
            {purgeDialogStatus === "success" && (
              <>
                <div className="flex justify-center mb-6">
                  <div className="p-4 bg-green-500/10 text-green-500 rounded-full border border-green-500/20">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-center mb-3">Successfully Purged</h2>
                <p className="text-center text-[rgb(var(--text-2))] mb-8 leading-relaxed text-[13px]">
                  Your database and raw files have been completely wiped.
                </p>
                <button
                  onClick={() => setPurgeDialogStatus("hidden")}
                  className="w-full py-3.5 rounded-2xl bg-brand hover:bg-brand-hover text-white text-[14px] font-bold transition-all shadow-lg"
                >
                  Continue
                </button>
              </>
            )}
            {purgeDialogStatus === "error" && (
              <>
                <div className="flex justify-center mb-6">
                  <div className="p-4 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
                    <XCircle className="w-10 h-10" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-center mb-3 text-red-500">Purge Failed</h2>
                <p className="text-center text-[rgb(var(--text-2))] mb-8 leading-relaxed text-[13px]">
                  {purgeError || "An unknown error occurred while trying to format the databases."}
                </p>
                <button
                  onClick={() => setPurgeDialogStatus("hidden")}
                  className="w-full py-3.5 rounded-2xl bg-[rgb(var(--surface-2))] hover:bg-[rgb(var(--surface-2))/80] text-[14px] font-bold transition-all"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
