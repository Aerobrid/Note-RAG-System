"use client";

import React, { useEffect, useState } from "react";
import { Archive, Trash2, FileText, Code2, Loader2, Key } from "lucide-react";
import { getFiles, deleteFile } from "@/lib/api";
import { cn } from "@/lib/utils";

type FileEntry = {
  name: string;
  size: number;
};

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
  return <FileText className="w-5 h-5 text-brand" />;
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await getFiles();
      setFiles(res.files);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const removeFile = async (name: string) => {
    if (deleting) return;
    if (!window.confirm(`Are you sure you want to delete ${name} from the index?`)) return;
    setDeleting(name);
    try {
      await deleteFile(name);
      setFiles((prev) => prev.filter(f => f.name !== name));
    } catch (e: any) {
      alert("Error deleting file: " + e.message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto w-full min-h-screen flex flex-col bg-[rgb(var(--bg))]">
      <div className="mb-10 text-center md:text-left">
        <div className="flex items-center gap-2 mb-2 justify-center md:justify-start">
           <Archive className="w-5 h-5 text-brand" />
           <span className="text-[10px] font-semibold text-[rgb(var(--text-2))] uppercase tracking-[0.2em]">Manage Workspace</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Indexed Files</h1>
        <p className="text-sm text-[rgb(var(--text-2))] max-w-xl leading-relaxed">
          Remove individual files from your local vector index without purging the entire database.
        </p>
      </div>

      <div className="flex flex-col border border-[rgb(var(--border))] rounded-[2rem] bg-[rgb(var(--surface))] overflow-hidden shadow-2xl shadow-black/[0.02]">
        <div className="p-6 border-b border-[rgb(var(--border))] flex items-center justify-between bg-[rgb(var(--surface-2))/20]">
          <h2 className="font-bold flex items-center gap-2 text-[14px]">
            Database Manifest
            <span className="px-2 py-0.5 bg-brand text-white text-[10px] rounded-full font-bold">
              {files.length}
            </span>
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[600px] min-h-[300px] custom-scroll divide-y divide-[rgb(var(--border))/50">
          {loading ? (
             <div className="h-full flex flex-col items-center justify-center p-12 space-y-4">
                 <Loader2 className="w-8 h-8 text-brand animate-spin" />
                 <p className="text-[13px] text-[rgb(var(--text-2))] font-bold">Loading manifested files...</p>
             </div>
          ) : files.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[rgb(var(--surface-2))] flex items-center justify-center">
                <Archive className="w-6 h-6 text-[rgb(var(--text-2))] opacity-40" />
              </div>
              <div className="space-y-1">
                 <p className="text-[13px] text-[rgb(var(--text))] font-bold">No mapped files exist</p>
                 <p className="text-[11px] text-[rgb(var(--text-2))]">Upload chunks into the RAG to see them here.</p>
              </div>
            </div>
          ) : (
            files.map((entry) => (
              <div key={entry.name} className="group flex items-center gap-4 px-6 py-4 hover:bg-[rgb(var(--surface-2))/20] transition-colors">
                <div className="shrink-0">{getIcon(entry.name)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate text-[rgb(var(--text))]">{entry.name}</p>
                  <p className="text-[10px] font-bold text-[rgb(var(--text-2))] uppercase opacity-60 mt-0.5">
                      {(entry.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <div className="shrink-0">
                   <button
                        onClick={() => removeFile(entry.name)}
                        disabled={deleting === entry.name}
                        className={cn(
                          "p-2 rounded-xl transition-all",
                          deleting === entry.name 
                            ? "text-[rgb(var(--text-2))] opacity-50 cursor-not-allowed" 
                            : "text-[rgb(var(--text-2))] hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 opacity-0 group-hover:opacity-100"
                        )}
                        title="Obliterate vector chunks securely"
                      >
                       {deleting === entry.name ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                   </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
