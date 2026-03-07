export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCostsByAgent, getCostsByModel, getCostsByProject } from "@clawops/analytics";
import { getDb, jsonError, parseSearch } from "@/lib/server/runtime";

const costQuery = z.object({ groupBy: z.enum(["agent", "model", "project"]).optional() });

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const { groupBy } = parseSearch(req, costQuery);
    const db = getDb();

    switch (groupBy) {
      case "model":
        return NextResponse.json(getCostsByModel(db).map((r) => ({
          name: r.group,
          totalCost: r.totalCost,
          totalTokensIn: r.totalIn,
          totalTokensOut: r.totalOut,
          count: r.count,
        })));
      case "project":
        return NextResponse.json(getCostsByProject(db).map((r) => ({
          name: r.group,
          totalCost: r.totalCost,
          totalTokensIn: r.totalIn,
          totalTokensOut: r.totalOut,
          count: r.count,
        })));
      case "agent":
      default:
        return NextResponse.json(getCostsByAgent(db).map((r) => ({
          name: r.group,
          totalCost: r.totalCost,
          totalTokensIn: r.totalIn,
          totalTokensOut: r.totalOut,
          count: r.count,
        })));
    }
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to fetch cost analytics", "INTERNAL_ERROR");
  }
}
