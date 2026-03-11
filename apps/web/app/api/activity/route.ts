export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  activityEvents,
  buildActivityEventQueryConditions,
  desc,
  and,
  type ActivityEventFilters,
} from "@clawops/core";
import { getDb, jsonError, parseSearch, requireAgentId } from "@/lib/server/runtime";

const activityFiltersSchema = z.object({
  type: z.string().optional(),
  agentId: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  severity: z.enum(["info", "warning", "error", "critical"]).optional(),
  source: z.enum(["system", "agent", "user", "sync", "workflow", "hook"]).optional(),
  limit: z
    .string()
    .transform((v) => {
      if (!v) return undefined;
      const n = Number.parseInt(v, 10);
      if (Number.isNaN(n) || n < 0 || n > 1000) throw new Error("limit must be 0-1000");
      return n;
    })
    .optional(),
  offset: z
    .string()
    .transform((v) => {
      if (!v) return undefined;
      const n = Number.parseInt(v, 10);
      if (Number.isNaN(n) || n < 0 || n > 100000) throw new Error("offset must be 0-100000");
      return n;
    })
    .optional(),
});

export async function GET(req: Request): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const filters = parseSearch(req, activityFiltersSchema);
    const db = getDb();

    const conditions = buildActivityEventQueryConditions(filters as ActivityEventFilters);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const queryLimit = filters.limit ?? 50;
    const queryOffset = filters.offset ?? 0;

    const query = db
      .select()
      .from(activityEvents)
      .where(whereClause)
      .orderBy(desc(activityEvents.createdAt))
      .limit(queryLimit)
      .offset(queryOffset);

    const events = query.all();

    return NextResponse.json(events);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }
    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to list activity events",
      "INTERNAL_ERROR"
    );
  }
}
