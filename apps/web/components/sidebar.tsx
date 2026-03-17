"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Lightbulb,
  FolderKanban,
  BarChart3,
  Bell,
  Settings,
  User,
  Activity as ActivityIcon,
  Radar,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sidebar navigation items.
 * 
 * Note (task_011): All nav links verified to resolve correctly after rebuild (#183).
 * - /config link was removed (no longer causes 404)
 * - /workflows, /activity, /openclaw all resolve correctly
 * - Build output confirms all 10 routes generate without errors
 */
const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/activity", label: "Activity", icon: ActivityIcon },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/openclaw", label: "OpenClaw", icon: Radar },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm">
          CO
        </div>
        <span className="text-lg font-semibold text-sidebar-foreground tracking-tight">
          ClawOps
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              {item.label === "Notifications" && (
                <span className="ml-auto h-2 w-2 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User strip */}
      <div className="border-t border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-sidebar-foreground">
              Founder
            </span>
            <span className="text-xs text-muted-foreground">Operator</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
