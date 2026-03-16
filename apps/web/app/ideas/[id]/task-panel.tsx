"use client";

import { useState } from "react";
import type { Task } from "@/lib/types";
import { TaskList } from "@/components/tasks/task-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateTaskDialog } from "./create-task-dialog";

type FilterTab = "all" | "active" | "done";

interface TaskPanelProps {
  ideaId: string;
  tasks: Task[];
  isPromoted: boolean;
}

const ACTIVE_STATUSES = new Set(["backlog", "todo", "in-progress", "review"]);
const DONE_STATUSES = new Set(["done", "cancelled"]);

export function TaskPanel({
  ideaId,
  tasks,
  isPromoted,
}: TaskPanelProps): React.JSX.Element {
  const [filter, setFilter] = useState<FilterTab>("all");

  const filtered = tasks.filter((t) => {
    if (filter === "active") return ACTIVE_STATUSES.has(t.status);
    if (filter === "done") return DONE_STATUSES.has(t.status);
    return true;
  });

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: tasks.length },
    {
      key: "active",
      label: "Active",
      count: tasks.filter((t) => ACTIVE_STATUSES.has(t.status)).length,
    },
    {
      key: "done",
      label: "Done",
      count: tasks.filter((t) => DONE_STATUSES.has(t.status)).length,
    },
  ];

  return (
    <Card className="sticky top-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Tasks ({tasks.length})
          </CardTitle>
          {!isPromoted && (
            <CreateTaskDialog ideaId={ideaId} variant="ghost" size="xs" />
          )}
        </div>
        {tasks.length > 0 && (
          <div className="flex gap-1 mt-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  filter === tab.key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">
              No tasks linked yet
            </p>
            {!isPromoted && (
              <CreateTaskDialog ideaId={ideaId} variant="ghost" size="sm" />
            )}
          </div>
        ) : (
          <TaskList
            tasks={filtered}
            showAssignee={false}
            showProject={false}
            compact
            emptyMessage="No matching tasks"
            emptyDescription="Try a different filter."
          />
        )}
      </CardContent>
    </Card>
  );
}
