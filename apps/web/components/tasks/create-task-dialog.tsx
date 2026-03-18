"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createTaskAction } from "@/app/tasks/actions";
import type { TaskPriority } from "@clawops/domain";

interface Project {
  id: string;
  name: string;
}

interface CreateTaskDialogProps {
  projects: Project[];
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

interface FormState {
  title: string;
  projectId: string;
  complexity: number;
  priority: TaskPriority;
  description: string;
  issueUrl: string;
}

const initialFormState: FormState = {
  title: "",
  projectId: "",
  complexity: 3,
  priority: "medium",
  description: "",
  issueUrl: "",
};

export function CreateTaskDialog({
  projects,
  variant = "default",
  size = "default",
}: CreateTaskDialogProps): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialFormState);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function handleOpenChange(open: boolean): void {
    setOpen(open);
    if (!open) {
      setError(null);
      setForm(initialFormState);
    }
  }

  function updateField<K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ): void {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }

    if (form.issueUrl) {
      try {
        const url = new URL(form.issueUrl);
        if (!["http:", "https:"].includes(url.protocol)) {
          setError("Issue URL must use http or https protocol");
          return;
        }
      } catch {
        setError("Please enter a valid URL for the issue link");
        return;
      }
    }

    startTransition(async () => {
      const result = await createTaskAction({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        projectId: form.projectId || undefined,
        priority: form.priority,
        complexity: form.complexity,
        issueUrl: form.issueUrl.trim() || undefined,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      handleOpenChange(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => handleOpenChange(true)}
      >
        <Plus className="h-4 w-4" />
        New Task
      </Button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-title"
        className="w-full max-w-lg"
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle id="create-task-title">Create New Task</CardTitle>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
                aria-label="Close dialog"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </Button>
            </div>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div
                  className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/20"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  ref={titleInputRef}
                  id="title"
                  type="text"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="Enter task title"
                  required
                  disabled={isPending}
                  aria-required="true"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="project" className="text-sm font-medium">
                  Project
                </label>
                <select
                  id="project"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={form.projectId}
                  onChange={(e) => updateField("projectId", e.target.value)}
                  disabled={isPending}
                >
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="complexity" className="text-sm font-medium">
                    Complexity
                  </label>
                  <select
                    id="complexity"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={form.complexity}
                    onChange={(e) =>
                      updateField("complexity", parseInt(e.target.value, 10))
                    }
                    disabled={isPending}
                  >
                    <option value={1}>1 - Very Easy</option>
                    <option value={2}>2 - Easy</option>
                    <option value={3}>3 - Medium</option>
                    <option value={4}>4 - Hard</option>
                    <option value={5}>5 - Very Hard</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="priority" className="text-sm font-medium">
                    Priority
                  </label>
                  <select
                    id="priority"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={form.priority}
                    onChange={(e) =>
                      updateField("priority", e.target.value as TaskPriority)
                    }
                    disabled={isPending}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Description
                </label>
                <textarea
                  id="description"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Describe the task"
                  rows={3}
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="issueUrl" className="text-sm font-medium">
                  Issue URL
                </label>
                <input
                  id="issueUrl"
                  type="url"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={form.issueUrl}
                  onChange={(e) => updateField("issueUrl", e.target.value)}
                  placeholder="https://github.com/owner/repo/issues/123"
                  disabled={isPending}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Task"
                  )}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  );
}
