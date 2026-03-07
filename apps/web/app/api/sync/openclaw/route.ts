export const dynamic = "force-dynamic";

import { openclaw } from "@clawops/sync";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getLastSyncResult, setLastSyncResult } from "@/lib/server/sync-state";

const syncRequestSchema = z.object({
  openclawDir: z.string().optional(),
  gatewayUrl: z.string().url().optional(),
  gatewayToken: z.string().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = syncRequestSchema.parse(await req.json());
    const scanResult = openclaw.scanOpenClaw({
      openclawDir: body.openclawDir,
      gatewayUrl: body.gatewayUrl,
    });
    const { agents, workspaces, gatewayUrl } = scanResult;

    let cronJobs: Awaited<ReturnType<typeof openclaw.fetchGatewayCronJobs>> = [];
    if (body.gatewayToken) {
      try {
        cronJobs = await openclaw.fetchGatewayCronJobs(gatewayUrl, body.gatewayToken);
      } catch {
        cronJobs = [];
      }
    }

    const state = {
      syncedAt: new Date().toISOString(),
      agentCount: agents.length,
      cronJobCount: cronJobs.length,
      agents: agents.map((a) => ({ id: a.id, name: a.name, workspacePath: a.workspacePath })),
    };
    setLastSyncResult(state);

    return NextResponse.json({
      success: true,
      syncedAt: state.syncedAt,
      agents,
      cronJobs,
      workspaces: workspaces.map((w) => ({
        agentId: w.agentId,
        path: w.path,
        hasFiles: Object.values(w.files).some(Boolean),
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  const last = getLastSyncResult();
  if (!last) {
    return NextResponse.json({ synced: false, message: "No sync has been run yet" });
  }
  return NextResponse.json({ synced: true, ...last });
}
