"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const statusTabs = [
  { label: "All",         value: "all",         danger: false },
  { label: "Backlog",     value: "backlog",      danger: false },
  { label: "Todo",        value: "todo",         danger: false },
  { label: "In Progress", value: "in-progress",  danger: false },
  { label: "Review",      value: "review",       danger: false },
  { label: "Blocked",     value: "blocked",      danger: true  },
  { label: "Done",        value: "done",         danger: false },
] as const;

type StatusValue = (typeof statusTabs)[number]["value"];

export interface TaskFilterBarProps {
  basePath: string;
  current: {
    status?: string;
    priority?: string;
    assigneeId?: string;
    view?: string;
  };
  counts?: Partial<Record<StatusValue, number>>;
  agents?: Array<{ id: string; name: string }>;
  showPriority?: boolean;
  showAssignee?: boolean;
  showViewToggle?: boolean;
}

function buildHref(
  basePath: string,
  current: TaskFilterBarProps["current"],
  overrides: Record<string, string | undefined>,
): string {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  if (merged.status && merged.status !== "all") params.set("status", merged.status);
  if (merged.priority && merged.priority !== "all") params.set("priority", merged.priority);
  if (merged.assigneeId && merged.assigneeId !== "all") params.set("assigneeId", merged.assigneeId);
  if (merged.view && merged.view !== "list") params.set("view", merged.view);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function TaskFilterBar({
  basePath,
  current,
  counts,
  agents,
  showPriority = true,
  showAssignee = true,
  showViewToggle = false,
}: TaskFilterBarProps): React.JSX.Element {
  const router = useRouter();
  const activeStatus = current.status ?? "all";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status tabs */}
      <div className="flex items-center gap-0.5 rounded-xl border border-white/8 bg-[#0d0d1a] p-1">
        {statusTabs.map((tab) => {
          const isActive = activeStatus === tab.value;
          const count = counts?.[tab.value];
          const showBadge = count != null && count > 0;

          return (
            <Link
              key={tab.value}
              href={buildHref(basePath, current, { status: tab.value })}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? tab.danger
                    ? "bg-rose-500/20 text-rose-300"
                    : "bg-[#5e6ad2]/20 text-[#5e6ad2]"
                  : tab.danger
                  ? "text-rose-400/60 hover:bg-rose-500/10 hover:text-rose-300"
                  : "text-[#6b7080] hover:bg-white/5 hover:text-[#ededef]",
              )}
            >
              {tab.label}
              {showBadge && (
                <span
                  className={cn(
                    "flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 font-mono text-[10px] leading-none",
                    isActive
                      ? tab.danger
                        ? "bg-rose-500/30 text-rose-200"
                        : "bg-[#5e6ad2]/30 text-[#5e6ad2]"
                      : tab.danger
                      ? "bg-rose-500/15 text-rose-400"
                      : "bg-white/8 text-[#6b7080]",
                  )}
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Priority filter */}
      {showPriority && (
        <select
          aria-label="Filter by priority"
          value={current.priority ?? "all"}
          onChange={(e) =>
            router.push(buildHref(basePath, current, { priority: e.target.value }))
          }
          className="h-8 rounded-lg border border-white/8 bg-[#0d0d1a] px-2 text-xs text-[#ededef]"
        >
          <option value="all">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      )}

      {/* Assignee filter */}
      {showAssignee && agents && agents.length > 0 && (
        <select
          aria-label="Filter by assignee"
          value={current.assigneeId ?? "all"}
          onChange={(e) =>
            router.push(buildHref(basePath, current, { assigneeId: e.target.value }))
          }
          className="h-8 rounded-lg border border-white/8 bg-[#0d0d1a] px-2 text-xs text-[#ededef]"
        >
          <option value="all">All assignees</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      )}

      {/* View toggle */}
      {showViewToggle && (
        <div className="ml-auto flex items-center gap-0.5 rounded-xl border border-white/8 bg-[#0d0d1a] p-1">
          <Link
            href={buildHref(basePath, current, { view: "list" })}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              (current.view ?? "list") === "list"
                ? "bg-[#5e6ad2]/20 text-[#5e6ad2]"
                : "text-[#6b7080] hover:bg-white/5 hover:text-[#ededef]",
            )}
          >
            List
          </Link>
          <Link
            href={buildHref(basePath, current, { view: "board" })}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              current.view === "board"
                ? "bg-[#5e6ad2]/20 text-[#5e6ad2]"
                : "text-[#6b7080] hover:bg-white/5 hover:text-[#ededef]",
            )}
          >
            Board
          </Link>
        </div>
      )}
    </div>
  );
}
