import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWorkflowDefinition, listWorkflowRuns } from "@clawops/workflows";
import { getDb } from "@/lib/server/runtime";
import { WorkflowDetailForm } from "./workflow-detail-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getWorkflowData(id: string) {
  const db = getDb();
  const workflow = getWorkflowDefinition(db, id);
  if (!workflow) return null;

  const runs = listWorkflowRuns(db, id);
  return { workflow, runs };
}

export default async function WorkflowDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const data = await getWorkflowData(id);

  if (!data) {
    notFound();
  }

  const { workflow, runs } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/workflows">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{workflow.name}</h1>
          <p className="mt-1 text-muted-foreground">Edit workflow and view run history</p>
        </div>
      </div>

      <WorkflowDetailForm
        workflow={{
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          status: workflow.status as "draft" | "active" | "paused" | "deprecated",
          triggerType: workflow.triggerType,
          triggerConfigObject: workflow.triggerConfigObject,
          stepsArray: workflow.stepsArray,
          createdAt: workflow.createdAt instanceof Date ? workflow.createdAt.toISOString() : String(workflow.createdAt),
          updatedAt: workflow.updatedAt instanceof Date ? workflow.updatedAt.toISOString() : String(workflow.updatedAt),
          version: workflow.version,
        }}
        runs={runs.map((r) => ({
          id: r.id,
          status: r.status as "pending" | "running" | "completed" | "failed" | "cancelled",
          triggeredBy: r.triggeredBy,
          createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        }))}
      />
    </div>
  );
}
