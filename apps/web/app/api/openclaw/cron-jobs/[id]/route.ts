export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { events, createActivityEvent, type DB } from "@clawops/core";
import { updateConnectionCronJob } from "@clawops/habits";
import {
  getDb,
  isNotFoundError,
  jsonError,
  requireAgentId,
} from "@/lib/server/runtime";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const patchBodySchema = z.object({
  enabled: z.boolean().optional(),
  name: z.string().min(1).optional(),
  schedule: z.unknown().optional(),
  scheduleKind: z.string().min(1).nullable().optional(),
  scheduleExpr: z.string().min(1).nullable().optional(),
  sessionTarget: z.string().min(1).nullable().optional(),
  gatewayToken: z.string().min(1).optional(),
}).refine(
  (body) => Object.keys(body).some((key) => key !== "gatewayToken"),
  "At least one cron job field must be provided",
);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { id } = paramsSchema.parse(await params);
    const body = patchBodySchema.parse(await req.json());
    const db = getDb();
    const gatewayToken =
      body.gatewayToken ??
      req.headers.get("x-openclaw-gateway-token") ??
      process.env["OPENCLAW_GATEWAY_TOKEN"] ??
      undefined;

    const updated = await updateConnectionCronJob(
      db,
      id,
      {
        enabled: body.enabled,
        name: body.name,
        schedule: body.schedule,
        scheduleKind: body.scheduleKind,
        scheduleExpr: body.scheduleExpr,
        sessionTarget: body.sessionTarget,
      },
      gatewayToken,
    );

    db.insert(events)
      .values({
        id: crypto.randomUUID(),
        action: "openclaw.cron_job.updated",
        entityType: "habit",
        entityId: updated.local.id,
        agentId: auth,
        meta: JSON.stringify({
          externalId: updated.local.externalId,
          fields: Object.keys(body).filter((key) => key !== "gatewayToken"),
        }),
        createdAt: new Date(),
      })
      .run();

    try {
      createActivityEvent(db as DB, {
        source: "user",
        type: "cron.updated",
        title: `Cron job updated: ${updated.local.name}`,
        entityType: "cron_job",
        entityId: updated.local.id,
        agentId: auth,
        metadata: JSON.stringify({
          name: updated.local.name,
          enabled: updated.local.enabled,
          fields: Object.keys(body).filter((key) => key !== "gatewayToken"),
        }),
      });
    } catch {
      // best-effort
    }

    return NextResponse.json(updated.local);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }

    if (isNotFoundError(err)) {
      const message = err instanceof Error ? err.message : "Not found";
      return jsonError(404, message, "NOT_FOUND");
    }

    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to update OpenClaw cron job",
      "INTERNAL_ERROR",
    );
  }
}
