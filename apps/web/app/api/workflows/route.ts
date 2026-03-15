export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { events, createActivityEvent, type DB } from "@clawops/core";
import {
  createWorkflowDefinition,
  listWorkflowDefinitions,
  validateWorkflow,
  type WorkflowStepDefinition,
} from "@clawops/workflows";
import { getAgentIdFromApiKey, getDb, jsonError } from "@/lib/server/runtime";

const workflowStatusValues = ["draft", "active", "paused", "deprecated"] as const;
const triggerTypeValues = ["manual", "scheduled", "event", "webhook"] as const;

const createWorkflowBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(workflowStatusValues).optional(),
  triggerType: z.enum(triggerTypeValues).optional(),
  triggerConfig: z.record(z.string(), z.unknown()).optional(),
  projectId: z.string().optional(),
  steps: z.array(z.object({
    name: z.string().min(1),
    type: z.string().min(1),
    key: z.string().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    condition: z.string().optional(),
    onError: z.enum(["stop", "continue", "retry"]).optional(),
    retryCount: z.number().int().min(0).max(10).optional(),
  })).min(1),
}).transform((data) => ({
  ...data,
  steps: data.steps as WorkflowStepDefinition[],
}));

export async function GET(): Promise<NextResponse> {
  try {
    const workflows = listWorkflowDefinitions(getDb());
    return NextResponse.json(workflows);
  } catch (err) {
    return jsonError(500, err instanceof Error ? err.message : "Failed to list workflows", "INTERNAL_ERROR");
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = createWorkflowBody.parse(await req.json());
    const db = getDb();
    const agentId = getAgentIdFromApiKey(req) ?? undefined;

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
      const w = createWorkflowDefinition(tx as unknown as DB, {
        name: body.name,
        description: body.description,
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

      createActivityEvent(tx as unknown as DB, {
        source: agentId ? "agent" : "user",
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
