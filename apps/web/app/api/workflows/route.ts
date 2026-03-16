export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { events, createActivityEvent } from "@clawops/core";
import {
  createWorkflowDefinition,
  listWorkflowDefinitions,
  validateWorkflow,
  type WorkflowStepDefinition,
} from "@clawops/workflows";
import { getDb, jsonError, parseSearch, requireAgentId } from "@/lib/server/runtime";

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

const createWorkflowBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string().optional(),
  status: workflowStatusEnum.optional(),
  projectId: z.string().optional(),
  triggerType: workflowTriggerTypeEnum.optional(),
  triggerConfig: z.record(z.string(), z.unknown()).optional(),
  steps: z.array(workflowStepSchema).min(1),
}).transform((data) => ({
  ...data,
  steps: data.steps as WorkflowStepDefinition[],
}));

const listWorkflowsQuery = z.object({
  status: workflowStatusEnum.optional(),
  triggerType: workflowTriggerTypeEnum.optional(),
  projectId: z.string().optional(),
});

export async function GET(req: Request): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const filters = parseSearch(req, listWorkflowsQuery);
    return NextResponse.json(listWorkflowDefinitions(getDb(), filters));
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to list workflows", "INTERNAL_ERROR");
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const agentId = requireAgentId(req);
  if (agentId instanceof NextResponse) return agentId;

  try {
    const body = createWorkflowBody.parse(await req.json());
    const db = getDb();

    try {
      validateWorkflow({
        name: body.name,
        steps: body.steps,
        triggerType: body.triggerType,
        triggerConfig: body.triggerConfig,
      });
    } catch (validationErr) {
      return jsonError(400, validationErr instanceof Error ? validationErr.message : "Validation failed", "VALIDATION_ERROR");
    }

    const workflow = db.transaction((tx) => {
      const w = createWorkflowDefinition(tx, {
        name: body.name,
        description: body.description,
        version: body.version,
        status: body.status ?? "draft",
        triggerType: body.triggerType ?? "manual",
        triggerConfig: body.triggerConfig,
        projectId: body.projectId,
        steps: body.steps,
      });
      tx.insert(events)
        .values({
          action: "workflow.created",
          entityType: "workflow",
          entityId: w.id,
          agentId,
          meta: JSON.stringify({ name: w.name }),
        })
        .run();
      createActivityEvent(tx, {
        source: "agent",
        type: "workflow.created",
        title: `Workflow created: ${w.name}`,
        entityType: "workflow",
        entityId: w.id,
        agentId,
        metadata: JSON.stringify({ name: w.name, status: w.status, triggerType: w.triggerType }),
      });
      return w;
    });

    return NextResponse.json(workflow, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to create workflow", "INTERNAL_ERROR");
  }
}
