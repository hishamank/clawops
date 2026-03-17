export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getTokenSummary } from "@clawops/analytics";
import { getDb, jsonError, parseSearch, requireAgentId } from "@/lib/server/runtime";

const tokenQuery = z.object({
  agentId: z.string().optional(),
  model: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function GET(req: Request): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const filters = parseSearch(req, tokenQuery);
    const summary = getTokenSummary(getDb(), {
      ...filters,
      from: filters.from ? new Date(filters.from) : undefined,
      to: filters.to ? new Date(filters.to) : undefined,
    });
    return NextResponse.json({
      totalTokensIn: summary.totalIn,
      totalTokensOut: summary.totalOut,
      totalCost: summary.totalCost,
      count: summary.count,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to fetch token analytics", "INTERNAL_ERROR");
  }
}
