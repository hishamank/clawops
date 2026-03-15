export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { listWorkflowRuns, getWorkflowDefinition } from "@clawops/workflows";
import { getDb, jsonError } from "@/lib/server/runtime";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { id } = await params;
    const db = getDb();

    const workflow = getWorkflowDefinition(db, id);
    if (!workflow) {
      return jsonError(404, "Workflow not found", "NOT_FOUND");
    }

    const runs = listWorkflowRuns(db, id);
    return NextResponse.json(runs);
  } catch (err) {
    return jsonError(500, err instanceof Error ? err.message : "Failed to list workflow runs", "INTERNAL_ERROR");
  }
}
