"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function isValidUrl(url: string): boolean {
  if (!url) return true;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

async function createTask(form: FormState): Promise<{ id: string } | null> {
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: form.title,
      description: form.description || undefined,
      projectId: form.projectId || undefined,
      properties: { complexity: form.complexity },
      priority: form.priority,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create task");
  }

  return response.json();
}

async function createIssueLink(taskId: string, issueUrl: string): Promise<void> {
  const response = await fetch(`/api/tasks/${taskId}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "issue",
      resourceType: "url",
      url: issueUrl,
      label: "Issue",
    }),
  });

  if (!response.ok) {
    // Silent failure - issue link is optional
  }
}

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

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }

    if (!isValidUrl(form.issueUrl)) {
      setError("Please enter a valid URL for the issue link");
      return;
    }

    startTransition(async () => {
      try {
        const task = await createTask(form);
        if (!task) {
          setError("Failed to create task");
          return;
        }

        if (form.issueUrl) {
          await createIssueLink(task.id, form.issueUrl);
        }

        handleOpenChange(false);
        router.refresh();
      } catch {
        setError("Failed to create task. Please try again.");
      }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Create New Task</CardTitle>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                <span className="sr-only">Close</span>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
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
                <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/20">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="Enter task title"
                  required
                  disabled={isPending}
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
