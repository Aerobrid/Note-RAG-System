"use client";

import React, { useEffect, useState, useMemo } from "react";
import { getFiles, deleteFile, getStats } from "@/lib/api";
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

function getFormat(filename: string) {
  const ext = filename.split(".").pop()?.toUpperCase() || "UNKNOWN";
  return ext;
}

function getIcon(filename: string) {
  const ext = "." + filename.split(".").pop()!.toLowerCase();
  if (CODE_EXTS.has(ext)) {
    return <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>code</span>;
  }
  if (ext === ".pdf") {
    return <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>;
  }
  if (ext === ".csv" || ext === ".xlsx") {
    return <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>table_chart</span>;
  }
  return <span className="material-symbols-outlined text-outline" style={{ fontVariationSettings: "'FILL' 1" }}>article</span>;
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dbLength, setDbLength] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  const [deleteDialogStatus, setDeleteDialogStatus] = useState<"hidden" | "confirm" | "success" | "error">("hidden");
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 7;

  useEffect(() => {
    fetchFilesAndStats();
  }, []);

  const fetchFilesAndStats = async () => {
    setLoading(true);
    try {
      const [res, statsRes] = await Promise.all([
         getFiles(),
         getStats(),
      ]);
      setFiles(res.files);
      setDbLength((statsRes.documents || 0) + (statsRes.code || 0));
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const triggerDelete = (name: string) => {
    setFileToDelete(name);
    setDeleteDialogStatus("confirm");
  };

  const executeDelete = async () => {
    if (!fileToDelete) return;
    setDeleting(fileToDelete);
    try {
      await deleteFile(fileToDelete);
      setFiles((prev) => prev.filter(f => f.name !== fileToDelete));
      setDbLength((prev) => Math.max(0, prev - 1));
      
      const newTotalPages = Math.ceil((files.length - 1) / ITEMS_PER_PAGE);
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages);
      }
      setDeleteDialogStatus("success");
    } catch (e: any) {
      setDeleteError(e.message);
      setDeleteDialogStatus("error");
    } finally {
      setDeleting(null);
    }
  };

  // Metrics Logic
  const totalIndexed = files.length > 0 ? files.length.toLocaleString() : dbLength.toLocaleString();
  const totalSizeBytes = files.reduce((acc, f) => acc + f.size, 0);
  const density = totalSizeBytes > 1024 * 1024 * 1024 
    ? (totalSizeBytes / (1024 * 1024 * 1024)).toFixed(1) + " GB"
    : (totalSizeBytes / (1024 * 1024)).toFixed(1) + " MB";

  // Slice files for table
  const paginatedFiles = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return files.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [files, currentPage]);

  const totalPages = Math.ceil(files.length / ITEMS_PER_PAGE) || 1;

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
        <div className="max-w-[1200px] w-full mx-auto relative z-10">
          
          {/* Page Header Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 animate-in fade-in duration-500 fly-in-from-bottom-2">
            <div>
              <h2 className="text-[3rem] lg:text-[3.5rem] font-extrabold font-headline leading-tight tracking-tight text-on-surface mb-2">Indexed Files</h2>
              <p className="text-on-surface-variant text-lg max-w-2xl font-light">
                 Manage documents currently indexed in the vector database for high-precision retrieval across the RAG network.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={fetchFilesAndStats}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-primary border border-outline-variant/20 hover:bg-surface-container-high transition-all text-sm font-medium disabled:opacity-50 active:scale-95"
              >
                <span className={cn("material-symbols-outlined text-lg", loading && "animate-spin")}>refresh</span>
                Refresh Index
              </button>
            </div>
          </div>

          {/* Stats Dashboard (Bento Style) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 animate-in fade-in duration-700 fly-in-from-bottom-4">
            <div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant/10 shadow-lg shadow-black/5">
              <p className="text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-1">Total Indexed</p>
              <p className="text-3xl font-extrabold text-primary">{totalIndexed}</p>
            </div>
            <div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant/10 shadow-lg shadow-black/5">
              <p className="text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-1">Total Size</p>
              <p className="text-3xl font-extrabold text-on-surface">{density}</p>
            </div>
            <div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant/10 shadow-lg shadow-black/5">
              <p className="text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-1">Last Update</p>
              <p className="text-3xl font-extrabold text-secondary">Live</p>
            </div>
          </div>

          {/* File List Table */}
          <div className="bg-surface-container-low rounded-xl overflow-hidden shadow-2xl shadow-black/10 border border-transparent animate-in fade-in duration-1000 fly-in-from-bottom-6 min-h-[400px] flex flex-col">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-high/50">
                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-on-surface-variant font-extrabold">File Name</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-on-surface-variant font-extrabold w-24">Format</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-on-surface-variant font-extrabold w-32">Status</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-on-surface-variant font-extrabold w-28">Size</th>
                    <th className="px-6 py-4 text-right w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {loading && files.length === 0 ? (
                     <tr>
                        <td colSpan={5} className="py-20 text-center">
                           <span className="material-symbols-outlined text-4xl text-primary animate-spin mb-4">settings</span>
                           <p className="text-on-surface-variant text-sm tracking-widest uppercase">Fetching Manifest...</p>
                        </td>
                     </tr>
                  ) : files.length === 0 ? (
                     <tr>
                        <td colSpan={5} className="py-20 text-center">
                           <span className="material-symbols-outlined text-4xl text-on-surface-variant opacity-50 mb-4">folder_off</span>
                           <p className="text-on-surface-variant tracking-widest text-sm uppercase">No files mapped in database</p>
                        </td>
                     </tr>
                  ) : (
                     paginatedFiles.map((entry) => (
                       <tr key={entry.name} className="group hover:bg-surface-container-highest/30 transition-colors">
                         <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                             {getIcon(entry.name)}
                             <span className="text-sm font-semibold text-on-surface max-w-sm lg:max-w-md truncate" title={entry.name}>
                               {entry.name}
                             </span>
                           </div>
                         </td>
                         <td className="px-6 py-4 text-xs tracking-widest text-on-surface-variant font-bold">{getFormat(entry.name)}</td>
                         <td className="px-6 py-4 text-sm text-primary uppercase tracking-widest font-semibold text-[10px]">Active</td>
                         <td className="px-6 py-4 text-xs font-mono text-on-surface-variant tracking-widest">
                           {(entry.size / 1024 / 1024) > 1 
                              ? `${(entry.size / 1024 / 1024).toFixed(1)} MB` 
                              : `${(entry.size / 1024).toFixed(1)} KB`}
                         </td>
                         <td className="px-6 py-4 text-right">
                           <button 
                             onClick={() => triggerDelete(entry.name)}
                             disabled={deleting === entry.name}
                             title="Obliterate Vector Entry"
                             className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-all disabled:opacity-30 disabled:pointer-events-none"
                           >
                             <span className={cn("material-symbols-outlined text-lg", deleting === entry.name && "animate-spin")}>
                                {deleting === entry.name ? "refresh" : "delete"}
                             </span>
                           </button>
                         </td>
                       </tr>
                     ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer / Pagination */}
            {files.length > 0 && (
               <div className="px-6 py-4 bg-surface-container-high/30 flex items-center justify-between border-t border-outline-variant/10 mt-auto">
                 <p className="text-xs text-on-surface-variant tracking-widest font-bold">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, files.length)} of {files.length} indexed files
                 </p>
                 <div className="flex items-center gap-2">
                   <button 
                     onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                     disabled={currentPage === 1}
                     className="p-1.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant disabled:opacity-30 transition-colors"
                   >
                     <span className="material-symbols-outlined text-sm">chevron_left</span>
                   </button>
                   <span className="text-xs font-bold text-on-surface px-2 tracking-widest">
                      {currentPage} / {totalPages}
                   </span>
                   <button 
                     onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                     disabled={currentPage === totalPages}
                     className="p-1.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant disabled:opacity-30 transition-colors"
                   >
                     <span className="material-symbols-outlined text-sm">chevron_right</span>
                   </button>
                 </div>
               </div>
            )}
          </div>
        </div>

        {/* Background Decorative Element (The "Mist") */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[120px]"></div>
          <div className="absolute top-[40%] -right-[10%] w-[50%] h-[50%] bg-secondary/5 rounded-full blur-[120px]"></div>
        </div>
        {/* Atmospheric Delete Modal */}
        {deleteDialogStatus !== "hidden" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-lowest/70 backdrop-blur-md px-4 animate-in fade-in duration-200">
            <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
              {deleteDialogStatus === "confirm" && (
                <>
                  <div className="flex justify-center mb-6">
                    <div className="p-4 bg-error/10 text-error rounded-full border border-error/20">
                      <span className="material-symbols-outlined text-4xl">warning</span>
                    </div>
                  </div>
                  <h2 className="text-xl font-bold text-center mb-3 text-on-surface">Delete Indexed File?</h2>
                  <p className="text-center text-on-surface-variant mb-8 leading-relaxed text-sm">
                    This will permanently erase the vectorized chunks for <strong className="text-on-surface break-words">{fileToDelete}</strong> from the database.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setDeleteDialogStatus("hidden"); setFileToDelete(null); }}
                      className="flex-1 py-3 rounded-xl bg-surface-container-highest hover:bg-surface-container-high text-on-surface text-[13px] font-bold transition-all border border-outline-variant/10"
                    >
                      Abort
                    </button>
                    <button
                      onClick={executeDelete}
                      className="flex-1 py-3 rounded-xl bg-error hover:bg-error-dim text-on-error text-[13px] font-bold transition-all shadow-lg shadow-error/20 flex items-center justify-center gap-2"
                    >
                      {deleting ? <span className="material-symbols-outlined text-sm animate-spin">refresh</span> : <span className="material-symbols-outlined text-sm">delete_forever</span>}
                      Confirm Drop
                    </button>
                  </div>
                </>
              )}
              {deleteDialogStatus === "success" && (
                <>
                  <div className="flex justify-center mb-6">
                    <div className="p-4 bg-primary/10 text-primary rounded-full border border-primary/20">
                      <span className="material-symbols-outlined text-4xl">check_circle</span>
                    </div>
                  </div>
                  <h2 className="text-xl font-bold text-center mb-3 text-on-surface">File Erased</h2>
                  <p className="text-center text-on-surface-variant mb-8 leading-relaxed text-sm">
                    The file vectors have been successfully unlinked and purged from local storage.
                  </p>
                  <button
                    onClick={() => { setDeleteDialogStatus("hidden"); setFileToDelete(null); }}
                    className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-[13px] font-bold transition-all shadow-lg"
                  >
                    Return to Active State
                  </button>
                </>
              )}
              {deleteDialogStatus === "error" && (
                <>
                  <div className="flex justify-center mb-6">
                    <div className="p-4 bg-error/10 text-error rounded-full border border-error/20">
                      <span className="material-symbols-outlined text-4xl">error</span>
                    </div>
                  </div>
                  <h2 className="text-xl font-bold text-center mb-3 text-error">Delete Terminated</h2>
                  <p className="text-center text-on-surface-variant mb-8 leading-relaxed text-sm">
                    {deleteError || "An error prevented dropping vectors. Check backend."}
                  </p>
                  <button
                    onClick={() => { setDeleteDialogStatus("hidden"); setFileToDelete(null); }}
                    className="w-full py-3 rounded-xl bg-surface-container-highest hover:bg-surface-container-high text-on-surface border border-outline-variant/10 text-[13px] font-bold transition-all"
                  >
                    Acknowledge
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
