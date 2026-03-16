"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const statusTabs = [
  { label: "All", value: "all" },
  { label: "Backlog", value: "backlog" },
  { label: "Todo", value: "todo" },
  { label: "In Progress", value: "in-progress" },
  { label: "Review", value: "review" },
  { label: "Done", value: "done" },
] as const;

export interface TaskFilterBarProps {
  basePath: string;
  current: {
    status?: string;
    priority?: string;
    assigneeId?: string;
    view?: string;
  };
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
      <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
        {statusTabs.map((tab) => (
          <Link
            key={tab.value}
            href={buildHref(basePath, current, { status: tab.value })}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              activeStatus === tab.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Priority filter */}
      {showPriority && (
        <select
          aria-label="Filter by priority"
          value={current.priority ?? "all"}
          onChange={(e) =>
            router.push(buildHref(basePath, current, { priority: e.target.value }))
          }
          className="h-8 rounded-lg border border-border bg-card px-2 text-sm text-foreground"
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
          className="h-8 rounded-lg border border-border bg-card px-2 text-sm text-foreground"
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
        <div className="ml-auto flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          <Link
            href={buildHref(basePath, current, { view: "list" })}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              (current.view ?? "list") === "list"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
            )}
          >
            List
          </Link>
          <Link
            href={buildHref(basePath, current, { view: "board" })}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              current.view === "board"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
            )}
          >
            Board
          </Link>
        </div>
      )}
    </div>
  );
}
