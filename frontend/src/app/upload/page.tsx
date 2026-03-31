"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, Code2, CheckCircle2, XCircle, Loader2, FolderOpen } from "lucide-react";
import { uploadFiles } from "@/lib/api";
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
  ".pdf": <FileText className="w-4 h-4 text-red-400" />,
  ".docx": <FileText className="w-4 h-4 text-blue-400" />,
  ".pptx": <FileText className="w-4 h-4 text-orange-400" />,
  ".py": <Code2 className="w-4 h-4 text-yellow-400" />,
  ".js": <Code2 className="w-4 h-4 text-yellow-300" />,
  ".ts": <Code2 className="w-4 h-4 text-blue-400" />,
};

function getIcon(filename: string) {
  const ext = "." + filename.split(".").pop()!.toLowerCase();
  return ICON_MAP[ext] ?? <FileText className="w-4 h-4 text-[rgb(var(--text-2))]" />;
}

export default function UploadPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    const entries: FileEntry[] = accepted.map((f) => ({ file: f, status: "pending" }));
    setFiles((prev) => [...prev, ...entries]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: true,
  });

  const handleUpload = async () => {
    const pending = files.filter((f) => f.status === "pending");
    if (!pending.length) return;

    setUploading(true);
    setFiles((prev) =>
      prev.map((f) => (f.status === "pending" ? { ...f, status: "uploading" } : f))
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
  const pendingCount = files.filter((f) => f.status === "pending").length;

  return (
    <div className="p-6 max-w-3xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Upload Notes</h1>
        <p className="text-sm text-[rgb(var(--text-2))] mt-1">
          Supports PDF, DOCX, PPTX, TXT, MD and code files. Files are auto-indexed - just drop and chat.
        </p>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors",
          isDragActive
            ? "border-brand-600 bg-brand-600/5"
            : "border-[rgb(var(--border))] hover:border-brand-600/40 hover:bg-[rgb(var(--surface-2))]"
        )}
      >
        <input {...getInputProps()} />
        <Upload className={cn("w-8 h-8", isDragActive ? "text-brand-500" : "text-[rgb(var(--text-2))]")} />
        <div className="text-center">
          <p className="text-sm font-medium">
            {isDragActive ? "Drop your files here" : "Drag & drop files, or click to browse"}
          </p>
          <p className="text-xs text-[rgb(var(--text-2))] mt-1">
            PDF · DOCX · PPTX · TXT · MD · PY · JS · TS · Java · C/C++ · IPYNB
          </p>
        </div>
      </div>

      {/* Pro tip */}
      <div className="mt-4 flex items-start gap-2 text-xs text-[rgb(var(--text-2))] bg-[rgb(var(--surface-2))] rounded-xl px-4 py-3">
        <FolderOpen className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          <strong className="text-[rgb(var(--text))]">Pro tip:</strong> Drop files directly into the{" "}
          <code className="font-mono text-brand-500">./notes/</code> folder and they&apos;ll be auto-indexed without uploading.
        </span>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">{files.length} file{files.length !== 1 ? "s" : ""}</h2>
            {files.some((f) => f.status === "done") && (
              <button onClick={removeDone} className="text-xs text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))]">
                Clear done
              </button>
            )}
          </div>

          <div className="border border-[rgb(var(--border))] rounded-xl overflow-hidden divide-y divide-[rgb(var(--border))]">
            {files.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 bg-[rgb(var(--surface))]">
                {getIcon(entry.file.name)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{entry.file.name}</p>
                  <p className="text-xs text-[rgb(var(--text-2))]">
                    {(entry.file.size / 1024).toFixed(0)} KB
                    {entry.error && <span className="text-red-400 ml-2">{entry.error}</span>}
                  </p>
                </div>
                <div className="shrink-0">
                  {entry.status === "pending" && <span className="text-xs text-[rgb(var(--text-2))]">Pending</span>}
                  {entry.status === "uploading" && <Loader2 className="w-4 h-4 animate-spin text-brand-500" />}
                  {entry.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                  {entry.status === "error" && <XCircle className="w-4 h-4 text-red-400" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Always show upload button */}
      <button
        onClick={handleUpload}
        disabled={uploading || pendingCount === 0}
        className={cn(
          "w-full mt-6 py-2.5 rounded-xl text-sm font-medium transition-colors",
          pendingCount > 0 && !uploading
            ? "bg-brand-600 text-white hover:bg-brand-700"
            : "bg-[rgb(var(--surface-2))] text-[rgb(var(--text-2))] cursor-not-allowed"
        )}
      >
        {uploading ? "Uploading & indexing..." : `Upload ${pendingCount} file${pendingCount !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
