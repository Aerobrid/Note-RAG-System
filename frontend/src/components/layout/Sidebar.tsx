"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare, Search, Upload, Cpu, Settings, BookOpen, ChevronLeft, ChevronRight, Plus, Trash2,
  Clock, Sparkles
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/chat",      icon: MessageSquare, label: "Chat" },
  { href: "/search",    icon: Search,        label: "Search" },
  { href: "/upload",    icon: Upload,        label: "Upload" },
  { href: "/finetune",  icon: Cpu,           label: "Fine-tune" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sessions, activeSessionId, sidebarOpen, setSidebarOpen,
          createSession, setActiveSession, deleteSession } = useAppStore();

  return (
    <aside
      className={cn(
        "flex flex-col h-screen transition-all duration-300 shrink-0 z-50 overflow-hidden",
        "bg-[rgb(var(--surface))] border-r border-[rgb(var(--border))]",
        sidebarOpen ? "w-64" : "w-16"
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-6">
        <div className="w-8 h-8 rounded-xl bg-brand flex items-center justify-center shrink-0 shadow-lg shadow-brand/20">
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        {sidebarOpen && (
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-[15px] tracking-tight truncate text-[rgb(var(--text))]">ScholarMind</span>
            <span className="text-[10px] text-brand font-bold uppercase tracking-widest leading-none">AI Intelligence</span>
          </div>
        )}
      </div>

      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="mx-auto p-2 rounded-xl text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))] transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Nav */}
      <div className="px-3 mt-2">
        {sidebarOpen && (
          <p className="px-3 mb-2 text-[10px] font-bold text-[rgb(var(--text-2))] uppercase tracking-[0.2em] opacity-60">General</p>
        )}
        <nav className="space-y-1">
          {NAV.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] transition-all duration-200 relative",
                pathname.startsWith(href)
                  ? "bg-brand/10 text-brand font-semibold"
                  : "text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
              )}
            >
              <Icon className={cn("w-5 h-5 shrink-0 transition-transform group-hover:scale-105", pathname.startsWith(href) ? "text-brand" : "text-[rgb(var(--text-2))]/60")} />
              {sidebarOpen && <span>{label}</span>}
              {pathname.startsWith(href) && (
                <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-brand" />
              )}
            </Link>
          ))}
        </nav>
      </div>

      {/* Chat sessions */}
      {sidebarOpen && pathname.startsWith("/chat") && (
        <div className="flex-1 flex flex-col mt-8 px-3 overflow-hidden">
          <div className="flex items-center justify-between px-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[rgb(var(--text-2))] uppercase tracking-[0.2em] opacity-60">Recents</span>
            </div>
            <button
              onClick={() => createSession()}
              className="p-1 rounded-md text-[rgb(var(--text-2))] hover:bg-brand/10 hover:text-brand transition-colors"
              title="New Chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scroll space-y-1 pr-1 pb-4">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer text-xs transition-all duration-200 border border-transparent",
                  s.id === activeSessionId
                    ? "bg-[rgb(var(--bg))] border-[rgb(var(--border))] text-[rgb(var(--text))] shadow-sm"
                    : "text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))/40] hover:text-[rgb(var(--text))]"
                )}
                onClick={() => setActiveSession(s.id)}
              >
                <MessageSquare className={cn("w-3.5 h-3.5 shrink-0", s.id === activeSessionId ? "text-brand" : "opacity-30")} />
                <span className="flex-1 truncate font-medium">{s.title}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-[rgb(var(--text-2))] hover:text-red-500 transition-all"
                  onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1" />

      {/* Footer */}
      <div className="p-3 border-t border-[rgb(var(--border))]">
        {sidebarOpen && (
          <div className="bg-brand/5 rounded-2xl p-4 mb-4 border border-brand/5">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-brand" />
              <span className="text-[10px] font-bold text-brand uppercase tracking-widest">Scholar Pro</span>
            </div>
            <p className="text-[10px] text-[rgb(var(--text-2))] leading-relaxed">
              Grounding is active. Using your custom notes for RAG.
            </p>
          </div>
        )}
        
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors",
            pathname === "/settings"
              ? "bg-brand/10 text-brand font-semibold"
              : "text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))]"
          )}
        >
          <Settings className={cn("w-5 h-5 shrink-0", pathname === "/settings" ? "text-brand" : "text-[rgb(var(--text-2))]/60")} />
          {sidebarOpen && <span>Settings</span>}
        </Link>
      </div>

      {sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute bottom-20 -right-0 p-1 bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-full transform translate-x-1/2 shadow-sm text-[rgb(var(--text-2))] hover:text-brand transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      )}
    </aside>
  );
}
