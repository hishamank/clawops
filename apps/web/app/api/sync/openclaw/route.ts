export const dynamic = "force-dynamic";

import { listSyncRuns, onboardOpenClaw, summarizeOpenClawOnboarding } from "@clawops/sync";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAgentIdFromApiKey, getDb, jsonError } from "@/lib/server/runtime";

const syncRequestSchema = z.object({
  openclawDir: z.string().optional(),
  gatewayUrl: z.string().url().optional(),
  gatewayToken: z.string().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  let body: z.infer<typeof syncRequestSchema>;

  try {
    body = syncRequestSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }

    return jsonError(400, "Invalid request body", "VALIDATION_ERROR");
  }

  try {
    const result = await onboardOpenClaw(getDb(), {
      source: "api.sync.openclaw",
      openclawDir: body.openclawDir,
      gatewayUrl: body.gatewayUrl,
      gatewayToken: body.gatewayToken,
      includeFiles: true,
      actorAgentId: getAgentIdFromApiKey(req) ?? undefined,
    });
    const summary = summarizeOpenClawOnboarding(result);

    return NextResponse.json({
      success: true,
      ...summary,
    });
  } catch (err) {
    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to onboard OpenClaw",
      "INTERNAL_ERROR",
    );
  }
}

export async function GET(): Promise<NextResponse> {
  const runs = listSyncRuns(getDb(), 10);
  const latest = runs[0];

  if (!latest) {
    return NextResponse.json({
      synced: false,
      message: "No sync has been run yet",
      runs: [],
    });
  }

  return NextResponse.json({
    synced: latest.status === "success",
    syncRunId: latest.id,
    syncedAt: latest.completedAt?.toISOString() ?? latest.startedAt.toISOString(),
    agentCount: latest.agentCount,
    cronJobCount: latest.cronJobCount,
    workspaceCount: latest.workspaceCount,
    status: latest.status,
    error: latest.error,
    runs,
  });
}
