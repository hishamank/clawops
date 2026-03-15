import { Workflow, Play, Plus, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { timeAgo } from "@/lib/time";
import { listWorkflowDefinitions, listWorkflowRuns } from "@clawops/workflows";
import { getDb } from "@/lib/server/runtime";

export const dynamic = "force-dynamic";

type WorkflowStatus = "draft" | "active" | "paused" | "deprecated";

const workflowStatusStyles: Record<WorkflowStatus, string> = {
  draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  paused: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  deprecated: "bg-red-500/10 text-red-400 border-red-500/20",
};

const workflowStatusLabels: Record<WorkflowStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  deprecated: "Deprecated",
};

const triggerTypeLabels: Record<string, string> = {
  manual: "Manual",
  scheduled: "Scheduled",
  event: "Event",
  webhook: "Webhook",
};

interface WorkflowWithRuns {
  id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  triggerType: string;
  createdAt: Date;
  updatedAt: Date;
  lastRun: { id: string; status: string; createdAt: Date } | null;
  failureCount: number;
}

async function getWorkflows(): Promise<WorkflowWithRuns[]> {
  const db = getDb();
  const workflows = listWorkflowDefinitions(db);

  return workflows.map((w) => {
    const runs = listWorkflowRuns(db, w.id);
    const lastRun = runs.length > 0 ? runs[0] : null;
    const failureCount = runs.filter((r) => r.status === "failed").length;

    return {
      id: w.id,
      name: w.name,
      description: w.description,
      status: w.status as WorkflowStatus,
      triggerType: w.triggerType,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      lastRun: lastRun
        ? { id: lastRun.id, status: lastRun.status, createdAt: lastRun.createdAt }
        : null,
      failureCount,
    };
  });
}

export default async function WorkflowsPage(): Promise<React.JSX.Element> {
  const workflows = await getWorkflows();

  const active = workflows.filter((w) => w.status === "active").length;
  const paused = workflows.filter((w) => w.status === "paused").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Workflows</h1>
          <p className="mt-1 text-muted-foreground">Automate your workflow with triggers and actions</p>
        </div>
        <Button asChild>
          <Link href="/workflows/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Workflow
          </Link>
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-primary/10 p-2">
                <Workflow className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{workflows.length}</p>
                <p className="text-sm text-muted-foreground">Total Workflows</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <Play className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{active}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-amber-500/10 p-2">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{paused}</p>
                <p className="text-sm text-muted-foreground">Paused</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflows list */}
      {workflows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Workflow className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No workflows yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first workflow to automate tasks
            </p>
            <Button className="mt-4" asChild>
              <Link href="/workflows/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Workflow
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((workflow) => (
            <Link key={workflow.id} href={`/workflows/${workflow.id}`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium leading-none">{workflow.name}</p>
                      {workflow.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {workflow.description}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className={workflowStatusStyles[workflow.status]}>
                      {workflowStatusLabels[workflow.status]}
                    </Badge>
                  </div>

                  <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Play className="h-3.5 w-3.5" />
                      {triggerTypeLabels[workflow.triggerType] || workflow.triggerType}
                    </span>
                    {workflow.lastRun ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {timeAgo(workflow.lastRun.createdAt instanceof Date ? workflow.lastRun.createdAt.toISOString() : String(workflow.lastRun.createdAt))}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        Never run
                      </span>
                    )}
                    {workflow.failureCount > 0 && (
                      <span className="flex items-center gap-1 text-red-500">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {workflow.failureCount} failed
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
