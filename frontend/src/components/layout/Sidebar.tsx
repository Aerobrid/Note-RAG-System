"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare, Search, Upload, Cpu, Settings, BookOpen, ChevronLeft, ChevronRight, Plus, Trash2,
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
        "flex flex-col h-screen border-r transition-all duration-200 shrink-0",
        "border-[rgb(var(--border))] bg-[rgb(var(--surface))]",
        sidebarOpen ? "w-60" : "w-14"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 py-4 border-b border-[rgb(var(--border))]">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        {sidebarOpen && (
          <span className="font-semibold text-sm truncate">RAG System</span>
        )}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="ml-auto text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))] transition-colors"
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="px-2 pt-2 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors",
              pathname.startsWith(href)
                ? "bg-brand-600/10 text-brand-600 dark:text-brand-400 font-medium"
                : "text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span>{label}</span>}
          </Link>
        ))}
      </nav>

      {/* Chat sessions — only in chat route */}
      {sidebarOpen && pathname.startsWith("/chat") && (
        <div className="flex-1 overflow-y-auto custom-scroll mt-3 px-2">
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-xs font-medium text-[rgb(var(--text-2))] uppercase tracking-wider">Chats</span>
            <button
              onClick={() => createSession()}
              className="text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))]"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs",
                  s.id === activeSessionId
                    ? "bg-[rgb(var(--surface-2))] text-[rgb(var(--text))]"
                    : "text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))]"
                )}
                onClick={() => setActiveSession(s.id)}
              >
                <span className="flex-1 truncate">{s.title}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-[rgb(var(--text-2))] hover:text-red-400"
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
      <div className="p-2 border-t border-[rgb(var(--border))]">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))]"
        >
          <Settings className="w-4 h-4 shrink-0" />
          {sidebarOpen && <span>Settings</span>}
        </Link>
      </div>
    </aside>
  );
}
