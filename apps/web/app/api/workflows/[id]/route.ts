export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { events, createActivityEvent, type DB } from "@clawops/core";
import {
  getWorkflowDefinition,
  updateWorkflowDefinition,
  validateWorkflow,
  type WorkflowStepDefinition,
} from "@clawops/workflows";
import { getAgentIdFromApiKey, getDb, jsonError } from "@/lib/server/runtime";

const workflowStatusValues = ["draft", "active", "paused", "deprecated"] as const;
const triggerTypeValues = ["manual", "scheduled", "event", "webhook"] as const;

const updateWorkflowBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(workflowStatusValues).optional(),
  triggerType: z.enum(triggerTypeValues).optional(),
  triggerConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  projectId: z.string().nullable().optional(),
  steps: z.array(z.object({
    name: z.string().min(1),
    type: z.string().min(1),
    key: z.string().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    condition: z.string().optional(),
    onError: z.enum(["stop", "continue", "retry"]).optional(),
    retryCount: z.number().int().min(0).max(10).optional(),
  })).min(1).optional(),
}).transform((data) => ({
  ...data,
  steps: data.steps as WorkflowStepDefinition[] | undefined,
}));

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { id } = await params;
    const workflow = getWorkflowDefinition(getDb(), id);

    if (!workflow) {
      return jsonError(404, "Workflow not found", "NOT_FOUND");
    }

    return NextResponse.json(workflow);
  } catch (err) {
    return jsonError(500, err instanceof Error ? err.message : "Failed to get workflow", "INTERNAL_ERROR");
  }
}

export async function PATCH(req: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = updateWorkflowBody.parse(await req.json());
    const db = getDb();
    const agentId = getAgentIdFromApiKey(req) ?? undefined;

    const existing = getWorkflowDefinition(db, id);
    if (!existing) {
      return jsonError(404, "Workflow not found", "NOT_FOUND");
    }

    if (body.steps || body.triggerType || body.triggerConfig) {
      try {
        validateWorkflow({
          name: body.name ?? existing.name,
          steps: body.steps,
          triggerType: body.triggerType,
          triggerConfig: body.triggerConfig,
        });
      } catch (validationErr) {
        return jsonError(400, validationErr instanceof Error ? validationErr.message : "Validation failed", "VALIDATION_ERROR");
      }
    }

    const workflow = db.transaction((tx) => {
      const w = updateWorkflowDefinition(tx as unknown as DB, id, {
        name: body.name,
        description: body.description,
        status: body.status,
        triggerType: body.triggerType,
        triggerConfig: body.triggerConfig,
        projectId: body.projectId,
        steps: body.steps,
      });

      tx.insert(events)
        .values({
          action: "workflow.updated",
          entityType: "workflow",
          entityId: w.id,
          agentId,
          meta: JSON.stringify({ name: w.name }),
        })
        .run();

      createActivityEvent(tx as unknown as DB, {
        source: agentId ? "agent" : "user",
        type: "workflow.updated",
        title: `Workflow updated: ${w.name}`,
        entityType: "workflow",
        entityId: w.id,
        agentId,
        metadata: JSON.stringify({ name: w.name, status: w.status }),
      });

      return w;
    });

    return NextResponse.json(workflow);
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to update workflow", "INTERNAL_ERROR");
  }
}
