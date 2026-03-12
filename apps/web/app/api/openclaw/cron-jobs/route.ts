export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { events, type DB } from "@clawops/core";
import {
  listCronJobs,
  syncCronJobs,
} from "@clawops/habits";
import { getOpenClawConnection } from "@clawops/sync";
import {
  getDb,
  jsonError,
  parseSearch,
  requireAgentId,
} from "@/lib/server/runtime";

const querySchema = z.object({
  connectionId: z.string().min(1).optional(),
  sync: z.enum(["true", "false"]).optional(),
});

function getGatewayToken(req: Request): string | undefined {
  return req.headers.get("x-openclaw-gateway-token") ?? process.env["OPENCLAW_GATEWAY_TOKEN"] ?? undefined;
}

export async function GET(req: Request): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { connectionId, sync } = parseSearch(req, querySchema);
    const db = getDb();

    if (sync === "true") {
      if (!connectionId) {
        return jsonError(400, "connectionId is required when sync=true", "VALIDATION_ERROR");
      }

      const connection = getOpenClawConnection(db, connectionId);
      if (!connection) {
        return jsonError(404, "OpenClaw connection not found", "OPENCLAW_CONNECTION_NOT_FOUND");
      }

      db.transaction((tx) => {
        syncCronJobs(tx as DB, connection, getGatewayToken(req));

        tx.insert(events)
          .values({
            id: crypto.randomUUID(),
            action: "openclaw.cron_jobs.synced",
            entityType: "openclaw_connection",
            entityId: connection.id,
            agentId: auth,
            meta: JSON.stringify({ connectionId: connection.id }),
            createdAt: new Date(),
          })
          .run();
      });
    }

    return NextResponse.json(
      listCronJobs(db as DB, connectionId ? { connectionId } : {}),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }

    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to list OpenClaw cron jobs",
      "INTERNAL_ERROR",
    );
  }
}
