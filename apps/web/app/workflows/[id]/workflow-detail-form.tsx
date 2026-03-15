"use client";

import { useActionState } from "react";
import { Play, Save, Clock, CheckCircle, XCircle, Circle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { WorkflowStatus, WorkflowRunStatus } from "./types";

const runStatusIcons: Record<WorkflowRunStatus, React.ElementType> = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
  cancelled: Circle,
};

const runStatusStyles: Record<WorkflowRunStatus, string> = {
  pending: "bg-zinc-500/10 text-zinc-400",
  running: "bg-blue-500/10 text-blue-400",
  completed: "bg-emerald-500/10 text-emerald-400",
  failed: "bg-red-500/10 text-red-400",
  cancelled: "bg-zinc-500/10 text-zinc-400",
};

interface WorkflowDetail {
  id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  triggerType: string;
  triggerConfigObject: Record<string, unknown>;
  stepsArray: Array<{ name: string; type: string; config?: Record<string, unknown> }>;
  createdAt: string;
  updatedAt: string;
  version: string;
}

interface RunSummary {
  id: string;
  status: WorkflowRunStatus;
  triggeredBy: string;
  createdAt: string;
}

interface WorkflowFormProps {
  workflow: WorkflowDetail;
  runs: RunSummary[];
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "never";

  const date = new Date(dateStr);
  if (!Number.isFinite(date.getTime())) return "unknown";
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function WorkflowDetailForm({ workflow, runs }: WorkflowFormProps): React.JSX.Element {
  const [updateState, updateAction, isUpdatePending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const name = formData.get("name") as string;
      const description = formData.get("description") as string | null;
      const status = formData.get("status") as string;
      const triggerType = formData.get("triggerType") as string;
      const triggerConfig = formData.get("triggerConfig") as string;
      const steps = formData.get("steps") as string;

      if (!name) {
        return { error: "Name is required" };
      }

      const updateData: Record<string, unknown> = {
        name,
        description: description || null,
      };

      if (status) updateData.status = status;
      if (triggerType) updateData.triggerType = triggerType;

      if (triggerConfig !== undefined) {
        if (triggerConfig === "") {
          updateData.triggerConfig = null;
        } else {
          try {
            updateData.triggerConfig = JSON.parse(triggerConfig);
          } catch {
            return { error: "Trigger config must be valid JSON" };
          }
        }
      }

      if (steps) {
        try {
          const parsedSteps = JSON.parse(steps);
          if (!Array.isArray(parsedSteps) || parsedSteps.length === 0) {
            return { error: "At least one step is required" };
          }
          updateData.steps = parsedSteps;
        } catch {
          return { error: "Steps must be valid JSON" };
        }
      }

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/workflows/${workflow.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updateData),
          }
        );

        if (!res.ok) {
          const errorData = await res.json();
          return { error: errorData.message || "Failed to update workflow" };
        }

        window.location.reload();
        return { error: undefined };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to update workflow" };
      }
    },
    { error: undefined }
  );

  const [triggerState, triggerAction, isTriggerPending] = useActionState(
    async (_prev: { error?: string }) => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/workflows/${workflow.id}/test`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ triggeredBy: "human" }),
          }
        );

        if (!res.ok) {
          const errorData = await res.json();
          return { error: errorData.message || "Failed to trigger workflow" };
        }

        window.location.reload();
        return { error: undefined };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to trigger workflow" };
      }
    },
    { error: undefined }
  );

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      {/* Edit Form */}
      <div className="lg:col-span-2">
        <form action={updateAction}>
          <Card>
            <CardHeader>
              <CardTitle>Workflow Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {updateState.error && (
                <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-400 border border-red-500/20">
                  {updateState.error}
                </div>
              )}

              {/* Name */}
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  defaultValue={workflow.name}
                  placeholder="My workflow"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  defaultValue={workflow.description ?? ""}
                  placeholder="Describe what this workflow does"
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* Status & Trigger Type */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="status" className="text-sm font-medium">
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={workflow.status}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="deprecated">Deprecated</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="triggerType" className="text-sm font-medium">
                    Trigger Type
                  </label>
                  <select
                    id="triggerType"
                    name="triggerType"
                    defaultValue={workflow.triggerType}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="manual">Manual</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="event">Event</option>
                    <option value="webhook">Webhook</option>
                  </select>
                </div>
              </div>

              {/* Trigger Config */}
              <div className="space-y-2">
                <label htmlFor="triggerConfig" className="text-sm font-medium">
                  Trigger Config (JSON)
                </label>
                <textarea
                  id="triggerConfig"
                  name="triggerConfig"
                  defaultValue={
                    workflow.triggerConfigObject ? JSON.stringify(workflow.triggerConfigObject, null, 2) : ""
                  }
                  placeholder='{"cronExpr": "0 * * * *"}'
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                />
              </div>

              {/* Steps */}
              <div className="space-y-2">
                <label htmlFor="steps" className="text-sm font-medium">
                  Steps (JSON)
                </label>
                <textarea
                  id="steps"
                  name="steps"
                  defaultValue={JSON.stringify(workflow.stepsArray, null, 2)}
                  placeholder='[{"name": "Create Task", "type": "task", "config": {}}]'
                  rows={8}
                  required
                  className="flex min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Define workflow steps as a JSON array. Each step needs a name and type.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isUpdatePending}>
                {isUpdatePending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>

      {/* Run History */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Run History</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={triggerAction}>
              <Button type="submit" variant="outline" className="w-full mb-4" disabled={isTriggerPending}>
                {isTriggerPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Run Now
              </Button>
            </form>

            {triggerState.error && (
              <div className="rounded-lg bg-red-500/10 p-2 text-xs text-red-400 mb-4">
                {triggerState.error}
              </div>
            )}

            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No runs yet. Run the workflow to see history.</p>
            ) : (
              <div className="space-y-3">
                {runs.slice(0, 10).map((run) => {
                  const StatusIcon = runStatusIcons[run.status] || Circle;
                  return (
                    <div
                      key={run.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <StatusIcon
                        className={`h-4 w-4 ${run.status === "running" ? "animate-spin" : ""}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            variant="outline"
                            className={runStatusStyles[run.status]}
                          >
                            {run.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {timeAgo(run.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Triggered by {run.triggeredBy}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Workflow Info */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{timeAgo(workflow.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Updated</span>
              <span>{timeAgo(workflow.updatedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version</span>
              <span>{workflow.version}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
