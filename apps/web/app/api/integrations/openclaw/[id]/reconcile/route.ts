export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { reconcileConnection } from "@clawops/sync";
import {
  getDb,
  jsonError,
  parseSearch,
  requireAgentId,
} from "@/lib/server/runtime";

const idParams = z.object({ id: z.string().min(1) });

const reconcileModeSchema = z.enum(["full", "sessions", "cron", "files"]);

const querySchema = z.object({
  mode: reconcileModeSchema.optional(),
});

const bodySchema = z.object({
  mode: reconcileModeSchema.optional(),
  gatewayToken: z.string().min(1).optional(),
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
    const { mode } = parseSearch(req, querySchema);

    const result = await reconcileConnection(getDb(), id, {
      mode,
      actorAgentId: auth ?? undefined,
    });

    return NextResponse.json({
      success: true,
      syncRunId: result.syncRunId,
      connectionId: result.connection.id,
      connectionName: result.connection.name,
      mode: result.items.length > 0 ? "full" : mode ?? "full",
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
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }

    return jsonError(
      err instanceof Error && err.message.includes("not found")
        ? 404
        : 500,
      err instanceof Error ? err.message : "Failed to reconcile OpenClaw connection",
      "RECONCILE_ERROR",
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { id } = idParams.parse(await params);
    const body = bodySchema.parse(await req.json());

    const result = await reconcileConnection(getDb(), id, {
      mode: body.mode,
      gatewayToken: body.gatewayToken,
      actorAgentId: auth ?? undefined,
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
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }

    return jsonError(
      err instanceof Error && err.message.includes("not found")
        ? 404
        : 500,
      err instanceof Error ? err.message : "Failed to reconcile OpenClaw connection",
      "RECONCILE_ERROR",
    );
  }
}
