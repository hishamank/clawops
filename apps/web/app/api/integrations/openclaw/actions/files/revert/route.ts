export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { revertTrackedOpenClawFile, OpenClawActionError } from "@clawops/sync/openclaw";
import { events, createActivityEvent } from "@clawops/core";
import { getDb, jsonError, requireAgentId } from "@/lib/server/runtime";

const revertFileBodySchema = z.object({
  revisionId: z.string().min(1),
});

export async function POST(req: Request): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const gatewayToken = req.headers.get("x-openclaw-gateway-token") ?? undefined;
  const db = getDb();

  let revisionId: string;
  try {
    const body = revertFileBodySchema.parse(await req.json());
    revisionId = body.revisionId;
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }
    return jsonError(400, "Invalid request body", "VALIDATION_ERROR");
  }

  try {
    const result = await revertTrackedOpenClawFile(db, {
      revisionId,
      actorAgentId: auth,
      source: "api",
      gatewayToken,
    });

    db.transaction((tx) => {
      tx.insert(events)
        .values({
          action: "file.reverted",
          entityType: "workspace_file_revision",
          entityId: revisionId,
          agentId: auth,
          meta: JSON.stringify({ relativePath: result.file.relativePath, fileId: result.file.id }),
        })
        .run();

      createActivityEvent(tx, {
        source: "agent",
        severity: "info",
        type: "file.reverted",
        title: `File reverted: ${result.file.relativePath}`,
        entityType: "workspace_file",
        entityId: result.file.id,
        agentId: auth,
        metadata: JSON.stringify({ revisionId, relativePath: result.file.relativePath }),
      });
    });

    return NextResponse.json({ ok: true, ...result.gatewayResult });
  } catch (err) {
    if (err instanceof OpenClawActionError) {
      try {
        createActivityEvent(db, {
          source: "agent",
          severity: "error",
          type: "file.revert_failed",
          title: `File revert failed`,
          agentId: auth,
          metadata: JSON.stringify({ revisionId, error: err.message, code: err.code }),
        });
      } catch {
        // ignore audit failure
      }

      if (err.status === 404) {
        return jsonError(404, err.message, err.code);
      }
      if (err.status === 422) {
        return jsonError(422, err.message, err.code);
      }
      return jsonError(502, err.message, err.code);
    }

    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to revert file",
      "INTERNAL_ERROR",
    );
  }
}
