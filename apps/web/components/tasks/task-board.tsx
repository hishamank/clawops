"use client";

import { useState, useCallback } from "react";
import type { TaskStatus } from "@clawops/domain";
import type { Task } from "@/lib/types";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
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
  onTaskClick?: (taskId: string) => void;
  onTaskDone?: (taskId: string) => void;
  onTaskDelete?: (taskId: string) => void;
  onTaskStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
}

export function TaskBoard({
  tasks,
  agentMap,
  projectMap,
  blockedTaskIds,
  columns = defaultColumns,
  onTaskClick,
  onTaskDone,
  onTaskDelete,
  onTaskStatusChange,
}: TaskBoardProps): React.JSX.Element {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  const grouped = new Map<TaskStatus, Task[]>();
  for (const col of columns) {
    grouped.set(col, []);
  }
  for (const task of tasks) {
    const col = grouped.get(task.status);
    if (col) col.push(task);
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const taskId = active.id as string;
      const newStatus = over.id as TaskStatus;
      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status === newStatus) return;

      onTaskStatusChange?.(taskId, newStatus);
    },
    [tasks, onTaskStatusChange],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((status) => {
          const columnTasks = grouped.get(status) ?? [];
          return (
            <DroppableColumn
              key={status}
              status={status}
              taskCount={columnTasks.length}
            >
              {columnTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No tasks
                </p>
              ) : (
                columnTasks.map((task) => (
                  <DraggableTaskCard
                    key={task.id}
                    task={task}
                    agentMap={agentMap}
                    projectMap={projectMap}
                    blocked={blockedTaskIds?.has(task.id)}
                    onTaskClick={onTaskClick}
                    onTaskDone={onTaskDone}
                    onTaskDelete={onTaskDelete}
                  />
                ))
              )}
            </DroppableColumn>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-72 rotate-2 scale-105 shadow-xl">
            <TaskCard
              task={activeTask}
              agentMap={agentMap}
              projectMap={projectMap}
              showAssignee={false}
              showProject={false}
              blocked={blockedTaskIds?.has(activeTask.id)}
              compact
              dragging
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ── DroppableColumn ──────────────────────────────────────────────────────────

interface DroppableColumnProps {
  status: TaskStatus;
  taskCount: number;
  children: React.ReactNode;
}

function DroppableColumn({
  status,
  taskCount,
  children,
}: DroppableColumnProps): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-72 flex flex-col rounded-xl border border-border bg-card transition-colors duration-200",
        isOver && "ring-1 ring-[#5e6ad2]/30 bg-[#5e6ad2]/5",
      )}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className={cn("h-2.5 w-2.5 rounded-full", columnColors[status])} />
        <span className="text-sm font-medium">{columnLabels[status]}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {taskCount}
        </span>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-16rem)]">
        {children}
      </div>
    </div>
  );
}

// ── DraggableTaskCard ────────────────────────────────────────────────────────

interface DraggableTaskCardProps {
  task: Task;
  agentMap?: Map<string, string>;
  projectMap?: Map<string, string>;
  blocked?: boolean;
  onTaskClick?: (taskId: string) => void;
  onTaskDone?: (taskId: string) => void;
  onTaskDelete?: (taskId: string) => void;
}

function DraggableTaskCard({
  task,
  agentMap,
  projectMap,
  blocked,
  onTaskClick,
  onTaskDone,
  onTaskDelete,
}: DraggableTaskCardProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "transition-opacity duration-150",
        isDragging && "opacity-30",
      )}
    >
      <TaskCard
        task={task}
        agentMap={agentMap}
        projectMap={projectMap}
        showAssignee={false}
        showProject={false}
        blocked={blocked}
        compact
        dragging={isDragging}
        onTaskClick={onTaskClick}
        onTaskDone={onTaskDone}
        onTaskDelete={onTaskDelete}
      />
    </div>
  );
}
