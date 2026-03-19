export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { reconcileConnection, listOpenClawConnections } from "@clawops/sync";
import { createActivityEvent, events } from "@clawops/core";
import { getDb, jsonError, requireAgentId } from "@/lib/server/runtime";

const bodySchema = z.object({
  mode: z.enum(["full", "sessions", "cron", "files"]).optional(),
  gatewayToken: z.string().min(1).optional(),
});

function getGatewayToken(req: Request): string | undefined {
  return req.headers.get("x-openclaw-gateway-token")?.trim() || undefined;
}

async function parseBodyOrEmpty(req: Request): Promise<z.infer<typeof bodySchema>> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return {};
  }
  try {
    const text = await req.text();
    if (!text.trim()) {
      return {};
    }
    return bodySchema.parse(JSON.parse(text));
  } catch {
    return {};
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const db = getDb();
    const connections = listOpenClawConnections(db);

    if (connections.length === 0) {
      return jsonError(404, "No OpenClaw connections found", "NO_CONNECTION");
    }

    const connection = connections[0];
    const body = await parseBodyOrEmpty(req);

    const result = await reconcileConnection(db, connection.id, {
      mode: body.mode,
      gatewayToken: body.gatewayToken ?? getGatewayToken(req),
      actorAgentId: auth ?? undefined,
    });

    db.insert(events)
      .values({
        action: "sync.run",
        entityType: "sync_run",
        entityId: result.syncRunId,
        agentId: auth,
        meta: JSON.stringify({
          connectionId: connection.id,
          mode: body.mode ?? "full",
        }),
      })
      .run();

    createActivityEvent(db, {
      source: "agent",
      type: "sync.run",
      title: `Sync triggered for ${connection.name}`,
      entityType: "sync_run",
      entityId: result.syncRunId,
      agentId: auth,
      metadata: JSON.stringify({
        connectionId: connection.id,
        connectionName: connection.name,
        mode: body.mode ?? "full",
        counts: {
          agents: result.agentCount,
          cronJobs: result.cronJobCount,
          workspaces: result.workspaceCount,
        },
      }),
    });

    return NextResponse.json({
      success: true,
      syncRunId: result.syncRunId,
      connectionId: result.connection.id,
      connectionName: result.connection.name,
      mode: body.mode ?? "full",
      completedAt: result.completedAt.toISOString(),
      counts: {
        agents: result.agentCount,
        cronJobs: result.cronJobCount,
        workspaces: result.workspaceCount,
        added: result.addedCount,
        updated: result.updatedCount,
        removed: result.removedCount,
      },
    });
  } catch (err) {
    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to run sync",
      "SYNC_ERROR",
    );
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const db = getDb();
    const connections = listOpenClawConnections(db);

    if (connections.length === 0) {
      return NextResponse.json({
        connected: false,
        message: "No OpenClaw connections found",
      });
    }

    const connection = connections[0];

    return NextResponse.json({
      connected: true,
      connectionId: connection.id,
      connectionName: connection.name,
      lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
      status: connection.status,
    });
  } catch (err) {
    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to get sync status",
      "INTERNAL_ERROR",
    );
  }
}