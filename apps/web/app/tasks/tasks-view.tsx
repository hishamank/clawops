"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useOptimistic } from "react";
import { CheckCircle2 } from "lucide-react";
import type { TaskStatus } from "@clawops/domain";
import type { Task } from "@/lib/types";
import { TaskList } from "@/components/tasks/task-list";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { useToast } from "@/components/toast";
import { updateTaskStatusAction } from "./actions";

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
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const agentMap = new Map(agents.map((a) => [a.id, a.name]));
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const blockedSet = new Set(blockedTaskIds);

  type OptimisticAction =
    | { taskId: string; action: "done" | "delete" }
    | { taskId: string; action: "status-change"; newStatus: TaskStatus };

  const [optimisticTasks, setOptimisticTasks] = useOptimistic(
    tasks,
    (state, update: OptimisticAction) => {
      if (update.action === "delete") {
        return state.filter((t) => t.id !== update.taskId);
      }
      if (update.action === "status-change") {
        return state.map((t) =>
          t.id === update.taskId
            ? {
                ...t,
                status: update.newStatus,
                completedAt: update.newStatus === "done" ? new Date().toISOString() : null,
              }
            : t,
        );
      }
      // "done"
      return state.map((t) =>
        t.id === update.taskId ? { ...t, status: "done" as const } : t,
      );
    },
  );

  const selectedTask = selectedTaskId
    ? optimisticTasks.find((t) => t.id === selectedTaskId) ?? null
    : null;

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const taskWasEdited = useRef(false);

  const handlePanelClose = () => {
    setSelectedTaskId(null);
    // Refresh once when closing, rather than after every field save
    if (taskWasEdited.current) {
      taskWasEdited.current = false;
      startTransition(() => {
        router.refresh();
      });
    }
  };

  const handleTaskUpdated = () => {
    taskWasEdited.current = true;
  };

  const handleTaskDone = (taskId: string) => {
    setOptimisticTasks({ taskId, action: "done" });
    startTransition(() => {
      router.refresh();
    });
  };

  const handleTaskDelete = (taskId: string) => {
    if (selectedTaskId === taskId) setSelectedTaskId(null);
    setOptimisticTasks({ taskId, action: "delete" });
    startTransition(() => {
      router.refresh();
    });
  };

  const handleTaskStatusChange = (taskId: string, newStatus: TaskStatus) => {
    setOptimisticTasks({ taskId, action: "status-change", newStatus });
    startTransition(async () => {
      const result = await updateTaskStatusAction(taskId, newStatus);
      if (result.error) {
        toast.error("Failed to move task", result.error);
      }
      router.refresh();
    });
  };

  return (
    <>
      {view === "board" ? (
        <TaskBoard
          tasks={optimisticTasks}
          agentMap={agentMap}
          projectMap={projectMap}
          blockedTaskIds={blockedSet}
          onTaskClick={handleTaskClick}
          onTaskDone={handleTaskDone}
          onTaskDelete={handleTaskDelete}
          onTaskStatusChange={handleTaskStatusChange}
        />
      ) : (
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
          onTaskClick={handleTaskClick}
          onTaskDone={handleTaskDone}
          onTaskDelete={handleTaskDelete}
        />
      )}

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          agents={agents}
          projects={projects}
          onClose={handlePanelClose}
          onTaskUpdated={handleTaskUpdated}
        />
      )}
    </>
  );
}
