"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, CheckSquare, Lightbulb, FolderKanban,
  Workflow, Activity, BarChart3, Radar, Bell, Settings,
  Search, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaletteItem {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  group: string;
}

// ─── Items ────────────────────────────────────────────────────────────────────

const items: PaletteItem[] = [
  { id: "overview",      label: "Overview",       description: "Fleet status at a glance",      href: "/",             icon: <LayoutDashboard className="h-4 w-4" />, group: "Navigate" },
  { id: "tasks",         label: "Tasks",          description: "Manage work across all agents",  href: "/tasks",        icon: <CheckSquare     className="h-4 w-4" />, group: "Navigate" },
  { id: "projects",      label: "Projects",       description: "Active and planned projects",    href: "/projects",     icon: <FolderKanban    className="h-4 w-4" />, group: "Navigate" },
  { id: "ideas",         label: "Ideas",          description: "Idea pipeline and incubation",   href: "/ideas",        icon: <Lightbulb       className="h-4 w-4" />, group: "Navigate" },
  { id: "workflows",     label: "Workflows",      description: "Automations and pipelines",      href: "/workflows",    icon: <Workflow        className="h-4 w-4" />, group: "Navigate" },
  { id: "activity",      label: "Activity",       description: "System-wide event audit trail",  href: "/activity",     icon: <Activity        className="h-4 w-4" />, group: "Navigate" },
  { id: "analytics",     label: "Analytics",      description: "Token usage and cost tracking",  href: "/analytics",    icon: <BarChart3       className="h-4 w-4" />, group: "Navigate" },
  { id: "openclaw",      label: "OpenClaw",       description: "Agent sync and connections",     href: "/openclaw",     icon: <Radar           className="h-4 w-4" />, group: "Navigate" },
  { id: "notifications", label: "Notifications",  description: "Alerts and system messages",     href: "/notifications",icon: <Bell            className="h-4 w-4" />, group: "Navigate" },
  { id: "settings",      label: "Settings",       description: "Configuration and connection",   href: "/settings",     icon: <Settings        className="h-4 w-4" />, group: "Navigate" },
  // Quick filters
  { id: "tasks-blocked", label: "Blocked Tasks",  description: "View tasks that are blocked",    href: "/tasks?status=blocked", icon: <CheckSquare className="h-4 w-4" />, group: "Quick Filters" },
  { id: "ideas-raw",     label: "Unreviewed Ideas", description: "Ideas needing your attention", href: "/ideas?status=raw",     icon: <Lightbulb   className="h-4 w-4" />, group: "Quick Filters" },
];

// ─── Component ────────────────────────────────────────────────────────────────

let _openCommandPalette: (() => void) | null = null;
export function openCommandPalette(): void { _openCommandPalette?.(); }

export function CommandPalette(): React.JSX.Element | null {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);
  const router    = useRouter();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelected(0);
  }, []);

  // Register global opener
  useEffect(() => {
    _openCommandPalette = () => setOpen(true);
    return () => { _openCommandPalette = null; };
  }, []);

  // Cmd+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const filtered = query.trim()
    ? items.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.description.toLowerCase().includes(query.toLowerCase()),
      )
    : items;

  // Group results
  const grouped = filtered.reduce<Record<string, PaletteItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  const flatFiltered = Object.values(grouped).flat();

  function navigate(href: string) {
    router.push(href);
    close();
  }

  useEffect(() => {
    if (selected >= flatFiltered.length) setSelected(0);
  }, [flatFiltered.length, selected]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { close(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, flatFiltered.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    }
    if (e.key === "Enter" && flatFiltered[selected]) {
      navigate(flatFiltered[selected].href);
    }
  }

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (!open) return null;

  let flatIdx = 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      style={{ animation: "palette-overlay-in 0.15s ease forwards" }}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={close}
        aria-hidden
      />

      {/* Palette */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative z-10 w-full max-w-[560px] overflow-hidden rounded-xl border border-white/10 bg-[#13131f] shadow-[0_24px_80px_rgba(0,0,0,0.7)]"
        style={{ animation: "palette-in 0.18s cubic-bezier(0.16,1,0.3,1) forwards" }}
        onKeyDown={onKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3.5">
          <Search className="h-4 w-4 shrink-0 text-[#6b7080]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            placeholder="Search pages and actions..."
            className="min-w-0 flex-1 bg-transparent text-sm text-[#ededef] placeholder:text-[#6b7080] outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-[#6b7080] sm:block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
          {flatFiltered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#6b7080]">
              No results for &quot;{query}&quot;
            </p>
          ) : (
            Object.entries(grouped).map(([group, groupItems]) => (
              <div key={group}>
                <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-[#6b7080]/70">
                  {group}
                </p>
                {groupItems.map((item) => {
                  const idx = flatIdx++;
                  const isSelected = idx === selected;
                  return (
                    <button
                      key={item.id}
                      data-idx={idx}
                      onClick={() => navigate(item.href)}
                      onMouseEnter={() => setSelected(idx)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        isSelected
                          ? "bg-[#5e6ad2]/15 text-[#ededef]"
                          : "text-[#ededef] hover:bg-white/5",
                      )}
                    >
                      <span className={cn("shrink-0", isSelected ? "text-[#5e6ad2]" : "text-[#6b7080]")}>
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-none">{item.label}</span>
                        <span className="mt-0.5 block truncate text-xs text-[#6b7080]">
                          {item.description}
                        </span>
                      </span>
                      {isSelected && (
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#5e6ad2]" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-white/8 px-4 py-2.5">
          {[
            ["↑↓", "navigate"],
            ["↵",  "open"],
            ["esc", "close"],
          ].map(([key, label]) => (
            <span key={key} className="flex items-center gap-1.5 text-[11px] text-[#6b7080]">
              <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">
                {key}
              </kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
