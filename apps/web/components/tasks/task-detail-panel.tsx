"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Loader2, Check, Calendar, User, FolderKanban } from "lucide-react";
import type { Task } from "@/lib/types";
import type { TaskStatus, TaskPriority } from "@clawops/domain";
import { timeAgo } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Agent {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

export interface TaskDetailPanelProps {
  task: Task;
  agents: Agent[];
  projects: Project[];
  onClose: () => void;
  onTaskUpdated: () => void;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Todo" },
  { value: "in-progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function TaskDetailPanel({
  task,
  agents,
  projects,
  onClose,
  onTaskUpdated,
}: TaskDetailPanelProps): React.JSX.Element {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? "");
  const [projectId, setProjectId] = useState(task.projectId ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.split("T")[0] : "");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Track the previous values to avoid saving unchanged fields.
  // Updated only after a successful save so failed saves can be retried.
  const prevTitle = useRef(task.title);
  const prevDescription = useRef(task.description ?? "");

  // Reset state only when switching to a different task
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setPriority(task.priority);
    setAssigneeId(task.assigneeId ?? "");
    setProjectId(task.projectId ?? "");
    setDueDate(task.dueDate ? task.dueDate.split("T")[0] : "");
    setSaveStatus("idle");
    setErrorMessage(null);
    prevTitle.current = task.title;
    prevDescription.current = task.description ?? "";
  }, [task.id]);

  // Clean up saved-status timer on unmount
  useEffect(() => {
    return () => clearTimeout(savedTimerRef.current);
  }, []);

  // Blur active element before closing to trigger pending saves
  const closePanel = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && panelRef.current?.contains(active)) {
      active.blur();
    }
    // Small delay to let blur handlers fire before closing
    setTimeout(onClose, 0);
  }, [onClose]);

  // Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") closePanel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closePanel]);

  const saveField = useCallback(
    async (field: string, value: string | null) => {
      setSaveStatus("saving");
      setErrorMessage(null);
      clearTimeout(savedTimerRef.current);

      try {
        const body: Record<string, string | null> = {};

        if (field === "dueDate" && value) {
          // Convert YYYY-MM-DD to ISO 8601 datetime
          body[field] = new Date(value + "T00:00:00.000Z").toISOString();
        } else if (field === "dueDate" && !value) {
          // Send null to clear the due date
          body[field] = null;
        } else {
          body[field] = value;
        }

        const res = await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message ?? `Failed to save (${res.status})`);
        }

        setSaveStatus("saved");
        savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
        onTaskUpdated();
        return true;
      } catch (err) {
        setSaveStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Failed to save");
        return false;
      }
    },
    [task.id, onTaskUpdated],
  );

  const handleTitleBlur = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      // Revert — title is required
      setTitle(prevTitle.current);
      return;
    }
    if (trimmed === prevTitle.current) return;
    setTitle(trimmed);
    const ok = await saveField("title", trimmed);
    if (ok) prevTitle.current = trimmed;
  };

  const handleDescriptionBlur = async () => {
    if (description === prevDescription.current) return;
    const ok = await saveField("description", description);
    if (ok) prevDescription.current = description;
  };

  const handleStatusChange = (value: TaskStatus) => {
    setStatus(value);
    saveField("status", value);
  };

  const handlePriorityChange = (value: TaskPriority) => {
    setPriority(value);
    saveField("priority", value);
  };

  const handleAssigneeChange = (value: string) => {
    setAssigneeId(value);
    // Send null to clear FK field rather than empty string
    saveField("assigneeId", value || null);
  };

  const handleProjectChange = (value: string) => {
    setProjectId(value);
    // Send null to clear FK field rather than empty string
    saveField("projectId", value || null);
  };

  const handleDueDateChange = (value: string) => {
    setDueDate(value);
    saveField("dueDate", value || null);
  };

  const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={closePanel}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit task: ${task.title}`}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] border-l border-border bg-background shadow-xl overflow-y-auto animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Task Detail</span>
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <Check className="h-3 w-3" />
                Saved
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-xs text-destructive">{errorMessage}</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={closePanel}
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-6 p-5">
          {/* Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              className="w-full bg-transparent text-lg font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none border-b border-transparent focus:border-border pb-1 transition-colors"
              placeholder="Task title"
              aria-label="Task title"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
              placeholder="Add a description (markdown supported)"
              aria-label="Task description"
            />
          </div>

          {/* Properties */}
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70 mb-3">
              Properties
            </h3>

            {/* Status */}
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">Status</span>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                className={cn(selectClass, "w-40")}
                aria-label="Status"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">Priority</span>
              <select
                value={priority}
                onChange={(e) => handlePriorityChange(e.target.value as TaskPriority)}
                className={cn(selectClass, "w-40")}
                aria-label="Priority"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div className="flex items-center justify-between py-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                Assignee
              </span>
              <select
                value={assigneeId}
                onChange={(e) => handleAssigneeChange(e.target.value)}
                className={cn(selectClass, "w-40")}
                aria-label="Assignee"
              >
                <option value="">Unassigned</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Project */}
            <div className="flex items-center justify-between py-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FolderKanban className="h-3 w-3" />
                Project
              </span>
              <select
                value={projectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className={cn(selectClass, "w-40")}
                aria-label="Project"
              >
                <option value="">No project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div className="flex items-center justify-between py-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Due Date
              </span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => handleDueDateChange(e.target.value)}
                className={cn(selectClass, "w-40")}
                aria-label="Due date"
              />
            </div>

            {/* Created (read-only) */}
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">Created</span>
              <span className="text-xs text-muted-foreground">{timeAgo(task.createdAt)}</span>
            </div>
          </div>

          {/* Meta */}
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70 mb-3">
              Meta
            </h3>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">ID</span>
              <span className="font-mono text-xs text-muted-foreground">{task.id}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">Source</span>
              <span className="text-xs text-foreground">{task.source}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
