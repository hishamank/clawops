"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useOptimistic } from "react";
import { CheckCircle2 } from "lucide-react";
import type { Task } from "@/lib/types";
import { TaskList } from "@/components/tasks/task-list";
import { TaskBoard } from "@/components/tasks/task-board";

interface TasksViewProps {
  tasks: Task[];
  agentMap: Map<string, string>;
  projectMap: Map<string, string>;
  blockedTaskIds: Set<string>;
  view: "list" | "board";
}

export function TasksView({
  tasks,
  agentMap,
  projectMap,
  blockedTaskIds,
  view,
}: TasksViewProps): React.JSX.Element {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [optimisticTasks, setOptimisticTasks] = useOptimistic(
    tasks,
    (state, { taskId, action }: { taskId: string; action: "done" | "delete" }) => {
      if (action === "delete") {
        return state.filter((t) => t.id !== taskId);
      }
      return state.map((t) =>
        t.id === taskId ? { ...t, status: "done" as const } : t,
      );
    },
  );

  const handleTaskDone = (taskId: string) => {
    setOptimisticTasks({ taskId, action: "done" });
    startTransition(() => {
      router.refresh();
    });
  };

  const handleTaskDelete = (taskId: string) => {
    setOptimisticTasks({ taskId, action: "delete" });
    startTransition(() => {
      router.refresh();
    });
  };

  const nonDoneCount = tasks.filter(
    (t) => t.status !== "done" && t.status !== "cancelled",
  ).length;

  if (view === "board") {
    return (
      <TaskBoard
        tasks={optimisticTasks}
        agentMap={agentMap}
        projectMap={projectMap}
        blockedTaskIds={blockedTaskIds}
        onTaskDone={handleTaskDone}
        onTaskDelete={handleTaskDelete}
      />
    );
  }

  return (
    <TaskList
      tasks={optimisticTasks}
      agentMap={agentMap}
      projectMap={projectMap}
      blockedTaskIds={blockedTaskIds}
      showAssignee
      showProject
      emptyIcon={CheckCircle2}
      emptyMessage="All done!"
      emptyDescription={
        nonDoneCount === 0
          ? "Every task is complete. Great work!"
          : "Tasks will appear here as they are created."
      }
      onTaskDone={handleTaskDone}
      onTaskDelete={handleTaskDelete}
    />
  );
}
