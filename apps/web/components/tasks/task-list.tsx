import { ListTodo } from "lucide-react";
import type { Task } from "@/lib/types";
import { TaskCard } from "./task-card";

export interface TaskListProps {
  tasks: Task[];
  agentMap?: Map<string, string>;
  projectMap?: Map<string, string>;
  blockedTaskIds?: Set<string>;
  showAssignee?: boolean;
  showProject?: boolean;
  showSpec?: boolean;
  compact?: boolean;
  limit?: number;
  emptyIcon?: React.ComponentType<{ className?: string }>;
  emptyMessage?: string;
  emptyDescription?: string;
}

export function TaskList({
  tasks,
  agentMap,
  projectMap,
  blockedTaskIds,
  showAssignee,
  showProject,
  showSpec,
  compact,
  limit,
  emptyIcon: EmptyIcon = ListTodo,
  emptyMessage = "No tasks yet",
  emptyDescription = "Tasks will appear here as they are created.",
}: TaskListProps): React.JSX.Element {
  const displayed = limit ? tasks.slice(0, limit) : tasks;

  if (displayed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <EmptyIcon className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        <p className="text-xs text-muted-foreground mt-1">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayed.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          agentMap={agentMap}
          projectMap={projectMap}
          showAssignee={showAssignee}
          showProject={showProject}
          showSpec={showSpec}
          blocked={blockedTaskIds?.has(task.id)}
          compact={compact}
        />
      ))}
    </div>
  );
}
