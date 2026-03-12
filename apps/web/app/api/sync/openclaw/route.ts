export const dynamic = "force-dynamic";

import { listSyncRuns, onboardOpenClaw } from "@clawops/sync";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, jsonError, requireAgentId } from "@/lib/server/runtime";

const syncRequestSchema = z.object({
  openclawDir: z.string().optional(),
  gatewayUrl: z.string().url().optional(),
  gatewayToken: z.string().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

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
      actorAgentId: auth,
    });

    return NextResponse.json({
      success: true,
      connectionId: result.connectionId,
      syncRunId: result.syncRunId,
      syncedAt: result.syncedAt,
      gatewayUrl: result.gatewayUrl,
      openclawDir: result.openclawDir,
      agents: result.agents,
      cronJobs: result.cronJobs,
      workspaces: result.workspaces.map((workspace) => ({
        agentId: workspace.agentId,
        path: workspace.path,
        hasFiles: Object.values(workspace.files).some(Boolean),
      })),
    });
  } catch (err) {
    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to onboard OpenClaw",
      "INTERNAL_ERROR",
    );
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

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
