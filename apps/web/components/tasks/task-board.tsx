"use client";

import type { TaskStatus } from "@clawops/domain";
import type { Task } from "@/lib/types";
import { TaskCard } from "./task-card";
import { cn } from "@/lib/utils";

const defaultColumns: TaskStatus[] = [
  "backlog",
  "todo",
  "in-progress",
  "review",
  "done",
];

const columnLabels: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  "in-progress": "In Progress",
  review: "Review",
  done: "Done",
  cancelled: "Cancelled",
};

const columnColors: Record<TaskStatus, string> = {
  backlog: "bg-zinc-500",
  todo: "bg-blue-500",
  "in-progress": "bg-amber-500",
  review: "bg-purple-500",
  done: "bg-emerald-500",
  cancelled: "bg-zinc-400",
};

export interface TaskBoardProps {
  tasks: Task[];
  agentMap?: Map<string, string>;
  projectMap?: Map<string, string>;
  blockedTaskIds?: Set<string>;
  columns?: TaskStatus[];
}

export function TaskBoard({
  tasks,
  agentMap,
  projectMap,
  blockedTaskIds,
  columns = defaultColumns,
}: TaskBoardProps): React.JSX.Element {
  const grouped = new Map<TaskStatus, Task[]>();
  for (const col of columns) {
    grouped.set(col, []);
  }
  for (const task of tasks) {
    const col = grouped.get(task.status);
    if (col) col.push(task);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((status) => {
        const columnTasks = grouped.get(status) ?? [];
        return (
          <div
            key={status}
            className="flex-shrink-0 w-72 flex flex-col rounded-xl border border-border bg-card"
          >
            {/* Column header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <span className={cn("h-2.5 w-2.5 rounded-full", columnColors[status])} />
              <span className="text-sm font-medium">{columnLabels[status]}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {columnTasks.length}
              </span>
            </div>
            {/* Column body */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-16rem)]">
              {columnTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No tasks
                </p>
              ) : (
                columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    agentMap={agentMap}
                    projectMap={projectMap}
                    showAssignee={false}
                    showProject={false}
                    blocked={blockedTaskIds?.has(task.id)}
                    compact
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
