export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { UnsupportedAnalyticsBreakdownError, getTokensByTemplate } from "@clawops/analytics";
import { getDb, jsonError, requireAgentId } from "@/lib/server/runtime";

export async function GET(_req: Request): Promise<NextResponse> {
  const actorAgentId = requireAgentId(_req);
  if (actorAgentId instanceof NextResponse) {
    return actorAgentId;
  }

  try {
    const db = getDb();
    const breakdown = getTokensByTemplate(db).map((r) => ({
      templateId: r.templateId,
      templateName: r.templateName,
      totalCost: r.totalCost,
      totalTokensIn: r.totalIn,
      totalTokensOut: r.totalOut,
      count: r.count,
    }));

    return NextResponse.json(breakdown);
  } catch (err) {
    if (err instanceof UnsupportedAnalyticsBreakdownError) {
      return jsonError(501, err.message, "ANALYTICS_BREAKDOWN_UNSUPPORTED");
    }
    if (err instanceof Error) {
      return jsonError(500, err.message, "INTERNAL_ERROR");
    }
    return jsonError(500, "Failed to fetch token breakdown by template", "INTERNAL_ERROR");
  }
}
