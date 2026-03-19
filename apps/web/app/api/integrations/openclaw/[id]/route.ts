export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { events, parseJsonObject } from "@clawops/core";
import {
  getOpenClawConnection,
  updateOpenClawConnection,
} from "@clawops/sync";
import {
  getDb,
  jsonError,
  requireAgentId,
} from "@/lib/server/runtime";

const connectionStatusSchema = z.enum(["active", "disconnected", "error"]);
const connectionSyncModeSchema = z.enum(["manual", "hybrid"]);
const idParams = z.object({ id: z.string().min(1) });

const updateConnectionBody = z.object({
  name: z.string().min(1).optional(),
  gatewayUrl: z.string().url().nullable().optional(),
  gatewayToken: z.string().min(1).optional(),
  status: connectionStatusSchema.optional(),
  syncMode: connectionSyncModeSchema.optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  lastSyncedAt: z.string().datetime().nullable().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { id } = idParams.parse(await params);
    const connection = getOpenClawConnection(getDb(), id);
    if (!connection) {
      return jsonError(404, "OpenClaw connection not found", "OPENCLAW_CONNECTION_NOT_FOUND");
    }
    return NextResponse.json(connection);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }

    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to load OpenClaw connection",
      "INTERNAL_ERROR",
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { id } = idParams.parse(await params);
    const body = updateConnectionBody.parse(await req.json());
    const db = getDb();

    const updated = db.transaction((tx) => {
      const existing = getOpenClawConnection(tx, id);
      if (!existing) {
        return null;
      }

      const nextMeta = {
        ...parseJsonObject(existing.meta),
        ...(body.meta ?? {}),
        ...(body.gatewayToken ? { gatewayToken: body.gatewayToken } : {}),
      };

      const connection = updateOpenClawConnection(tx, id, {
        name: body.name,
        gatewayUrl: body.gatewayUrl,
        status: body.status,
        syncMode: body.syncMode,
        hasGatewayToken: body.gatewayToken ? true : undefined,
        meta:
          body.meta !== undefined || body.gatewayToken
            ? nextMeta
            : undefined,
        lastSyncedAt:
          body.lastSyncedAt === undefined
            ? undefined
            : body.lastSyncedAt === null
              ? null
              : new Date(body.lastSyncedAt),
      });

      if (!connection) {
        return null;
      }

      tx.insert(events)
        .values({
          action: "openclaw.connection.updated",
          entityType: "openclaw_connection",
          entityId: connection.id,
          agentId: auth,
          meta: JSON.stringify({
            fields: Object.keys(body),
          }),
        })
        .run();

      return connection;
    });

    if (!updated) {
      return jsonError(404, "OpenClaw connection not found", "OPENCLAW_CONNECTION_NOT_FOUND");
    }

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }

    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to update OpenClaw connection",
      "INTERNAL_ERROR",
    );
  }
}
