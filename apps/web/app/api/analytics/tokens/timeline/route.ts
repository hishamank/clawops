export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getTokenTimeline, type Granularity } from "@clawops/analytics";
import { getDb, jsonError, parseSearch, requireAgentId } from "@/lib/server/runtime";

const timelineQuery = z.object({
  agentId: z.string().optional(),
  model: z.string().optional(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  granularity: z.enum(["hour", "day", "week", "month"]).optional(),
});

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const auth = requireAgentId(req);
    if (auth instanceof NextResponse) return auth;
    const params = parseSearch(req, timelineQuery);
    const db = getDb();

    const timeline = getTokenTimeline(db, {
      agentId: params.agentId,
      model: params.model,
      from: new Date(params.from),
      to: new Date(params.to),
      granularity: params.granularity as Granularity | undefined,
    });

    return NextResponse.json(timeline);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }
    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to fetch token timeline",
      "INTERNAL_ERROR",
    );
  }
}
