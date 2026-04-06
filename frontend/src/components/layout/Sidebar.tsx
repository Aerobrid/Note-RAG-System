"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/chat",      icon: "chat",           label: "Chat" },
  { href: "/search",    icon: "search",         label: "Search" },
  { href: "/upload",    icon: "upload_file",    label: "Upload" },
  { href: "/files",     icon: "folder_open",    label: "Files" },
  { href: "/finetune",  icon: "model_training", label: "Fine-tune" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sessions, activeSessionId, createSession, setActiveSession, deleteSession } = useAppStore();

  return (
    <aside className="hidden md:flex flex-col h-full w-64 border-r border-outline-variant/15 bg-surface-variant/80 backdrop-blur-xl shadow-[40px_60px_-10px_rgba(0,0,0,0.12)] shrink-0 z-50">
      {/* Top: Brand & CTA */}
      <div className="px-5 pt-8 pb-4 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary" style={{ fontVariationSettings: "'FILL' 1" }}>anchor</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight leading-none">RAG System</h1>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/70 mt-1 font-bold">Personal Knowledge Base</p>
          </div>
        </div>
        
        <button 
          onClick={() => createSession()}
          className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-on-primary rounded-xl font-bold transition-all active:scale-95 duration-150 shadow-lg shadow-primary/10"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          <span className="font-manrope text-sm font-medium tracking-wide">New Session</span>
        </button>
      </div>

      {/* Middle: Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-hide space-y-1">
        {NAV.map(({ href, icon, label }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-r-lg transition-colors duration-200 group",
                isActive
                  ? "text-primary font-bold border-l-2 border-primary bg-surface-container-high"
                  : "text-secondary-dim hover:text-primary hover:bg-surface-container-high/50 font-medium"
              )}
            >
              <span className="material-symbols-outlined">{icon}</span>
              <span className="font-manrope text-sm tracking-wide">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Scrollable Recent Sessions */}
      {pathname.startsWith("/chat") && (
        <div className="h-1/3 flex flex-col border-t border-outline-variant/15 bg-surface-container-low/30">
          <div className="px-5 py-3 flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant/60">Recent Sessions</span>
            <span className="material-symbols-outlined text-xs text-on-surface-variant/40">history</span>
          </div>
          
          <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-0.5 custom-scrollbar">
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => setActiveSession(s.id)}
                className={cn(
                  "group flex items-center justify-between gap-3 px-4 py-2 text-xs rounded-lg transition-all duration-200 cursor-pointer",
                  s.id === activeSessionId
                    ? "text-primary bg-surface-container-high/60 font-semibold"
                    : "text-on-surface-variant hover:text-primary hover:bg-surface-container-high/40"
                )}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="material-symbols-outlined text-[14px]">history</span>
                  <span className="truncate">{s.title || "New session"}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-on-surface-variant hover:text-error transition-all"
                  title="Delete Session"
                >
                  <span className="material-symbols-outlined text-[14px]">delete</span>
                </button>
              </div>
            ))}
            {sessions.length === 0 && (
               <div className="p-4 text-xs text-on-surface-variant/50 text-center italic">No prior sessions found</div>
            )}
          </div>
        </div>
      )}
      
      {/* Settings Link */}
      <div className="p-3 border-t border-outline-variant/15">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200",
            pathname === "/settings"
              ? "text-primary font-bold bg-surface-container-high"
              : "text-secondary-dim hover:text-primary hover:bg-surface-container-high/50 font-medium"
          )}
        >
          <span className="material-symbols-outlined">settings</span>
          <span className="font-manrope text-sm tracking-wide">Settings</span>
        </Link>
      </div>
    </aside>
  );
}
