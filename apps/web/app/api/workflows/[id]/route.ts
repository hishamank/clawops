export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { events, createActivityEvent } from "@clawops/core";
import {
  getWorkflowDefinition,
  updateWorkflowDefinition,
  validateWorkflow,
  type WorkflowStepDefinition,
} from "@clawops/workflows";
import { getDb, jsonError, requireAgentId } from "@/lib/server/runtime";

const workflowStatusEnum = z.enum(["draft", "active", "paused", "deprecated"]);
const workflowTriggerTypeEnum = z.enum(["manual", "scheduled", "event", "webhook"]);

const workflowStepSchema = z.object({
  key: z.string().optional(),
  name: z.string().min(1),
  type: z.enum(["task", "agent", "script", "condition", "parallel", "wait", "webhook", "notification"]),
  config: z.record(z.string(), z.unknown()).optional(),
  condition: z.string().optional(),
  onError: z.enum(["stop", "continue", "retry"]).optional(),
  retryCount: z.number().int().min(0).max(10).optional(),
});

const idParams = z.object({ id: z.string().min(1) });

const updateWorkflowBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  version: z.string().optional(),
  status: workflowStatusEnum.optional(),
  projectId: z.string().nullable().optional(),
  triggerType: workflowTriggerTypeEnum.optional(),
  triggerConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  steps: z.array(workflowStepSchema).min(1).optional(),
}).transform((data) => ({
  ...data,
  steps: data.steps as WorkflowStepDefinition[] | undefined,
}));

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = idParams.parse(await params);
    const workflow = getWorkflowDefinition(getDb(), id);
    if (!workflow) return jsonError(404, "Workflow not found", "WORKFLOW_NOT_FOUND");
    return NextResponse.json(workflow);
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to get workflow", "INTERNAL_ERROR");
  }
}

export async function PATCH(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const agentId = requireAgentId(req);
  if (agentId instanceof NextResponse) return agentId;

  try {
    const { id } = idParams.parse(await params);
    const body = updateWorkflowBody.parse(await req.json());
    const db = getDb();

    const existing = getWorkflowDefinition(db, id);
    if (!existing) {
      return jsonError(404, "Workflow not found", "WORKFLOW_NOT_FOUND");
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
      const w = updateWorkflowDefinition(tx, id, {
        name: body.name,
        description: body.description,
        version: body.version,
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
          meta: JSON.stringify({ fields: Object.keys(body) }),
        })
        .run();
      createActivityEvent(tx, {
        source: "agent",
        type: "workflow.updated",
        title: `Workflow updated: ${w.name}`,
        entityType: "workflow",
        entityId: w.id,
        agentId,
        metadata: JSON.stringify({ fields: Object.keys(body), status: body.status }),
      });
      return w;
    });

    return NextResponse.json(workflow);
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to update workflow", "INTERNAL_ERROR");
  }
}
