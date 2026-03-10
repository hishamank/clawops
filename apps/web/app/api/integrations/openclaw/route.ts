export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import path from "node:path";
import { z } from "zod";
import { events, type DB } from "@clawops/core";
import {
  listOpenClawConnections,
  upsertOpenClawConnection,
} from "@clawops/sync";
import {
  getDb,
  jsonError,
  requireAgentId,
} from "@/lib/server/runtime";

const connectionStatusSchema = z.enum(["active", "disconnected", "error"]);
const connectionSyncModeSchema = z.enum(["manual", "hybrid"]);

const upsertConnectionBody = z.object({
  name: z.string().min(1).optional(),
  rootPath: z.string().min(1),
  gatewayUrl: z.string().url().optional(),
  gatewayToken: z.string().min(1).optional(),
  status: connectionStatusSchema.optional(),
  syncMode: connectionSyncModeSchema.optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

function defaultConnectionName(rootPath: string): string {
  const baseName = path.basename(rootPath);
  if (!baseName || baseName === "." || baseName === path.sep) {
    return "OpenClaw";
  }
  return `OpenClaw ${baseName}`;
}

export async function GET(req: Request): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const connections = listOpenClawConnections(getDb());
    return NextResponse.json(connections);
  } catch (err) {
    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to list OpenClaw connections",
      "INTERNAL_ERROR",
    );
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = upsertConnectionBody.parse(await req.json());
    const db = getDb();
    const result = db.transaction((tx) => {
      const upserted = upsertOpenClawConnection(tx as unknown as DB, {
        name: body.name ?? defaultConnectionName(body.rootPath),
        rootPath: body.rootPath,
        gatewayUrl: body.gatewayUrl,
        status: body.status,
        syncMode: body.syncMode,
        hasGatewayToken: body.gatewayToken ? true : undefined,
        meta: body.meta,
      });

      tx.insert(events)
        .values({
          action: upserted.created
            ? "openclaw.connection.created"
            : "openclaw.connection.updated",
          entityType: "openclaw_connection",
          entityId: upserted.connection.id,
          agentId: auth,
          meta: JSON.stringify({
            rootPath: upserted.connection.rootPath,
            gatewayUrl: upserted.connection.gatewayUrl,
            created: upserted.created,
          }),
        })
        .run();

      return upserted;
    });

    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }

    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to save OpenClaw connection",
      "INTERNAL_ERROR",
    );
  }
}
