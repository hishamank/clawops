"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Ban, Trash2, X, Check } from "lucide-react";
import type { Task } from "@/lib/types";
import { timeAgo } from "@/lib/time";
import { StatusBadge } from "@/components/status-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { markTaskDoneAction, deleteTaskAction } from "@/app/tasks/actions";

export interface TaskCardProps {
  task: Task;
  agentMap?: Map<string, string>;
  projectMap?: Map<string, string>;
  showAssignee?: boolean;
  showProject?: boolean;
  showSpec?: boolean;
  blocked?: boolean;
  href?: string;
  compact?: boolean;
  onTaskClick?: (taskId: string) => void;
  onTaskDone?: (taskId: string) => void;
  onTaskDelete?: (taskId: string) => void;
}

export function TaskCard({
  task,
  agentMap,
  projectMap,
  showAssignee = true,
  showProject = true,
  showSpec = true,
  blocked = false,
  href,
  compact = true,
  onTaskClick,
  onTaskDone,
  onTaskDelete,
}: TaskCardProps): React.JSX.Element {
  const router = useRouter();
  const target = href ?? `/tasks/${task.id}`;
  const isDone = task.status === "done";

  const [optimisticDone, setOptimisticDone] = useState(isDone);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [doneError, setDoneError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDoneToggle = () => {
    if (optimisticDone) return;
    setOptimisticDone(true);
    setDoneError(null);
    startTransition(async () => {
      const result = await markTaskDoneAction(task.id);
      if (result.error) {
        setOptimisticDone(false);
        setDoneError(result.error);
        setTimeout(() => setDoneError(null), 3000);
      } else {
        onTaskDone?.(task.id);
      }
    });
  };

  const handleDeleteConfirm = () => {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteTaskAction(task.id);
      if (result.error) {
        setShowDeleteConfirm(false);
        setDeleteError(result.error);
        setTimeout(() => setDeleteError(null), 3000);
      } else {
        onTaskDelete?.(task.id);
      }
    });
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (e.defaultPrevented) return;
    if (onTaskClick) {
      onTaskClick(task.id);
    } else {
      router.push(target);
    }
  };

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (onTaskClick) {
        onTaskClick(task.id);
      } else {
        router.push(target);
      }
    }
  };

  return (
    <div className="group relative">
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        className={cn(
          "transition-all duration-200 ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl",
          isPending && "opacity-50 pointer-events-none",
        )}
      >
        <Card className="hover:bg-accent/50 py-2">
          <CardContent className={cn("flex items-center gap-3", compact ? "py-2" : "py-3")}>
            <Checkbox
              checked={optimisticDone}
              onCheckedChange={handleDoneToggle}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
              aria-label={`Mark "${task.title}" as done`}
              className="shrink-0"
            />
            <PriorityBadge priority={task.priority} />
            <span className="flex flex-col min-w-0 flex-1">
              <span
                className={cn(
                  "text-sm font-medium truncate",
                  optimisticDone && "line-through text-muted-foreground",
                )}
              >
                {task.title}
              </span>
              {doneError && (
                <span className="text-xs text-destructive truncate">{doneError}</span>
              )}
            </span>
            <StatusBadge status={optimisticDone ? "done" : task.status} />
            {blocked && <Ban className="h-4 w-4 text-rose-400 shrink-0" />}
            {showSpec && task.specContent && (
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            {showAssignee && (
              <span className="text-xs text-muted-foreground shrink-0 w-24 text-right">
                {task.assigneeId
                  ? agentMap?.get(task.assigneeId) ?? "Unknown"
                  : "Unassigned"}
              </span>
            )}
            {showProject && (
              <span className="text-xs text-muted-foreground shrink-0 w-20 text-right">
                {task.projectId
                  ? projectMap?.get(task.projectId) ?? "—"
                  : "—"}
              </span>
            )}
            <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">
              {timeAgo(task.createdAt)}
            </span>
          </CardContent>
        </Card>
      </div>

      <div
        className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 transition-all duration-200 ease-out z-10",
          showDeleteConfirm
            ? "opacity-100 translate-x-0"
            : "invisible group-hover:visible group-hover:translate-x-0 translate-x-2",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {showDeleteConfirm ? (
          <>
            <span className="text-xs text-muted-foreground mr-1">Delete?</span>
            <Button
              variant="destructive"
              size="icon-xs"
              onClick={handleDeleteConfirm}
              aria-label="Confirm delete"
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setShowDeleteConfirm(false)}
              aria-label="Cancel delete"
            >
              <X className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label={`Delete task "${task.title}"`}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      {deleteError && (
        <div className="absolute left-0 top-full mt-1 z-20">
          <span className="text-xs text-destructive bg-background border border-destructive/30 rounded px-2 py-0.5 shadow-sm">
            {deleteError}
          </span>
        </div>
      )}
    </div>
  );
}
