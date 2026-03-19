"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CheckSquare, Lightbulb, FolderKanban,
  BarChart3, Bell, Settings, User, Activity as ActivityIcon,
  Radar, Workflow, ChevronLeft, ChevronRight, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { openCommandPalette } from "@/components/command-palette";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SidebarCounts {
  tasks: number;
  ideas: number;
  notifications: number;
}

// ─── Nav structure ────────────────────────────────────────────────────────────

const navGroups = [
  {
    label: "Workspace",
    items: [
      { href: "/",          label: "Overview",   icon: LayoutDashboard, countKey: null            as null | keyof SidebarCounts },
      { href: "/tasks",     label: "Tasks",      icon: CheckSquare,     countKey: "tasks"         as keyof SidebarCounts },
      { href: "/projects",  label: "Projects",   icon: FolderKanban,    countKey: null            as null | keyof SidebarCounts },
      { href: "/ideas",     label: "Ideas",      icon: Lightbulb,       countKey: "ideas"         as keyof SidebarCounts },
      { href: "/workflows", label: "Workflows",  icon: Workflow,        countKey: null            as null | keyof SidebarCounts },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/activity",  label: "Activity",   icon: ActivityIcon,    countKey: null as null | keyof SidebarCounts },
      { href: "/analytics", label: "Analytics",  icon: BarChart3,       countKey: null as null | keyof SidebarCounts },
      { href: "/openclaw",  label: "OpenClaw",   icon: Radar,           countKey: null as null | keyof SidebarCounts },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/notifications", label: "Notifications", icon: Bell,    countKey: "notifications" as keyof SidebarCounts },
      { href: "/settings",      label: "Settings",      icon: Settings, countKey: null as null | keyof SidebarCounts },
    ],
  },
] as const;

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  count,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  count?: number;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium",
        "transition-colors duration-100",
        isActive
          ? "nav-active-indicator bg-[#5e6ad2]/12 text-[#5e6ad2]"
          : "text-[#6b7080] hover:bg-white/5 hover:text-[#ededef]",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-[#5e6ad2]" : "")} />

      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {count != null && count > 0 && (
            <span
              className={cn(
                "ml-auto flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1",
                "font-mono text-[10px] font-medium leading-none",
                isActive
                  ? "bg-[#5e6ad2]/20 text-[#5e6ad2]"
                  : "bg-white/8 text-[#6b7080]",
              )}
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </>
      )}

      {/* Collapsed badge dot */}
      {collapsed && count != null && count > 0 && (
        <span className="absolute right-1.5 top-1 h-1.5 w-1.5 rounded-full bg-[#5e6ad2]" />
      )}

      {/* Collapsed tooltip */}
      {collapsed && (
        <span className="pointer-events-none absolute left-full ml-3 z-50 hidden whitespace-nowrap rounded-md bg-[#13131f] px-2.5 py-1.5 text-xs text-[#ededef] shadow-lg ring-1 ring-white/10 group-hover:block">
          {label}
          {count != null && count > 0 && (
            <span className="ml-1.5 text-[#5e6ad2]">{count}</span>
          )}
        </span>
      )}
    </Link>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({ counts }: { counts: SidebarCounts }): React.JSX.Element {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Persist collapse state
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sidebar-collapsed");
      if (stored !== null) setCollapsed(stored === "true");
    } catch {
      // localStorage unavailable (SSR / private browsing)
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem("sidebar-collapsed", String(next)); } catch {
        // ignore
      }
      return next;
    });
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <aside
      className={cn(
        "sidebar-transition flex h-screen shrink-0 flex-col",
        "border-r bg-sidebar",
        "border-[rgba(255,255,255,0.06)]",
        collapsed ? "w-14" : "w-[232px]",
      )}
    >
      {/* ── Logo + toggle ── */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-[rgba(255,255,255,0.06)]",
          collapsed ? "justify-center px-0" : "justify-between px-4",
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#5e6ad2] text-[11px] font-bold text-white">
              CO
            </div>
            <span className="text-sm font-semibold tracking-tight text-[#ededef]">ClawOps</span>
          </div>
        )}

        {collapsed && (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#5e6ad2] text-[11px] font-bold text-white">
            CO
          </div>
        )}

        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md",
            "text-[#6b7080] transition-colors hover:bg-white/8 hover:text-[#ededef]",
            collapsed ? "absolute -right-3 top-4" : "ml-auto",
          )}
        >
          {collapsed
            ? <ChevronRight className="h-3.5 w-3.5" />
            : <ChevronLeft  className="h-3.5 w-3.5" />
          }
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-2 py-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#6b7080]/50">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  isActive={isActive(item.href)}
                  count={item.countKey != null ? counts[item.countKey] : undefined}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Cmd+K trigger ── */}
      <div className="shrink-0 border-t border-[rgba(255,255,255,0.06)] px-2 py-2">
        {!collapsed ? (
          <button
            onClick={openCommandPalette}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2",
              "text-[#6b7080] transition-colors hover:bg-white/5 hover:text-[#ededef]",
            )}
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left text-xs">Search...</span>
            <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 font-mono text-[9px]">
              ⌘K
            </kbd>
          </button>
        ) : (
          <button
            onClick={openCommandPalette}
            title="Search (⌘K)"
            className="flex w-full items-center justify-center rounded-md py-2 text-[#6b7080] transition-colors hover:bg-white/5 hover:text-[#ededef]"
          >
            <Search className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── User strip ── */}
      <div
        className={cn(
          "shrink-0 border-t border-[rgba(255,255,255,0.06)] p-3",
          collapsed ? "flex justify-center" : "flex items-center gap-2.5",
        )}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1a1a2e] ring-1 ring-white/10">
          <User className="h-3.5 w-3.5 text-[#6b7080]" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-[#ededef]">Founder</p>
            <p className="truncate text-[10px] text-[#6b7080]">Operator</p>
          </div>
        )}
      </div>
    </aside>
  );
}
