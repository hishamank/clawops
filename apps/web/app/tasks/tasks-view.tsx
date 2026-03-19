"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useOptimistic } from "react";
import { CheckCircle2 } from "lucide-react";
import type { Task } from "@/lib/types";
import { TaskList } from "@/components/tasks/task-list";
import { TaskBoard } from "@/components/tasks/task-board";

interface Agent { id: string; name: string }
interface Project { id: string; name: string }

interface TasksViewProps {
  tasks: Task[];
  agents: Agent[];
  projects: Project[];
  blockedTaskIds: string[];
  view: "list" | "board";
}

export function TasksView({
  tasks,
  agents,
  projects,
  blockedTaskIds,
  view,
}: TasksViewProps): React.JSX.Element {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const agentMap = new Map(agents.map((a) => [a.id, a.name]));
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const blockedSet = new Set(blockedTaskIds);

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

  if (view === "board") {
    return (
      <TaskBoard
        tasks={optimisticTasks}
        agentMap={agentMap}
        projectMap={projectMap}
        blockedTaskIds={blockedSet}
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
      blockedTaskIds={blockedSet}
      showAssignee
      showProject
      emptyIcon={CheckCircle2}
      emptyMessage="All done!"
      emptyDescription="Every task is complete. Great work!"
      onTaskDone={handleTaskDone}
      onTaskDelete={handleTaskDelete}
    />
  );
}
