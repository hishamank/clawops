export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { listWorkflowRuns, executeWorkflow, WorkflowNotActiveError } from "@clawops/workflows";
import { getAgentIdFromApiKey, getDb, jsonError, requireAgentId } from "@/lib/server/runtime";

const idParams = z.object({ id: z.string().min(1) });

const triggerRunBody = z.object({
  triggeredBy: z.enum(["human", "agent", "schedule", "event"]).optional(),
  triggeredById: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = idParams.parse(await params);
    return NextResponse.json(listWorkflowRuns(getDb(), id));
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to list workflow runs", "INTERNAL_ERROR");
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = idParams.parse(await params);
    const body = triggerRunBody.parse(await req.json());
    const agentId = getAgentIdFromApiKey(req) ?? undefined;
    const runId = await executeWorkflow(getDb(), id, {
      triggeredBy: body.triggeredBy ?? (agentId ? "agent" : "human"),
      triggeredById: body.triggeredById ?? agentId,
      metadata: body.metadata,
    });
    return NextResponse.json({ runId }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    if (err instanceof WorkflowNotActiveError) return jsonError(422, err.message, "WORKFLOW_NOT_ACTIVE");
    if (err instanceof Error && err.message.includes("not found")) return jsonError(404, err.message, "WORKFLOW_NOT_FOUND");
    return jsonError(500, err instanceof Error ? err.message : "Failed to trigger workflow run", "INTERNAL_ERROR");
  }
}
