export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { events, createActivityEvent, type DB } from "@clawops/core";
import { createWorkflowRun, getWorkflowDefinition } from "@clawops/workflows";
import { getDb, jsonError, requireAgentId } from "@/lib/server/runtime";

const triggerSourceValues = ["human", "agent", "schedule", "event"] as const;

const triggerWorkflowBody = z.object({
  triggeredBy: z.enum(triggerSourceValues).optional(),
  triggeredById: z.string().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const agentId = requireAgentId(req);
  if (agentId instanceof NextResponse) return agentId;

  try {
    const { id } = await params;
    const body = triggerWorkflowBody.parse(await req.json());
    const db = getDb();

    const workflow = getWorkflowDefinition(db, id);
    if (!workflow) {
      return jsonError(404, "Workflow not found", "NOT_FOUND");
    }

    const run = db.transaction((tx) => {
      const r = createWorkflowRun(tx as unknown as DB, {
        workflowId: id,
        triggeredBy: body.triggeredBy ?? "agent",
        triggeredById: body.triggeredById,
        status: "pending",
      });

      tx.insert(events)
        .values({
          action: "workflow_run.started",
          entityType: "workflow_run",
          entityId: r.id,
          agentId,
          meta: JSON.stringify({ workflowId: id, workflowName: workflow.name }),
        })
        .run();

      createActivityEvent(tx as unknown as DB, {
        source: "agent",
        type: "workflow_run.started",
        title: `Workflow run started: ${workflow.name}`,
        entityType: "workflow",
        entityId: id,
        agentId,
        metadata: JSON.stringify({ runId: r.id, workflowName: workflow.name, triggeredBy: r.triggeredBy }),
      });

      return r;
    });

    return NextResponse.json(run, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to trigger workflow", "INTERNAL_ERROR");
  }
}
