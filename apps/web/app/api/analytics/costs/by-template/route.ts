export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCostsByTemplate } from "@clawops/analytics";
import { getDb, jsonError } from "@/lib/server/runtime";

export async function GET(): Promise<NextResponse> {
  try {
    const db = getDb();
    const breakdown = getCostsByTemplate(db).map((r) => ({
      templateId: r.templateId,
      templateName: r.templateName,
      totalCost: r.totalCost,
      totalTokensIn: r.totalIn,
      totalTokensOut: r.totalOut,
      count: r.count,
    }));

    return NextResponse.json(breakdown);
  } catch (err) {
    if (err instanceof Error) {
      return jsonError(500, err.message, "INTERNAL_ERROR");
    }
    return jsonError(500, "Failed to fetch cost breakdown by template", "INTERNAL_ERROR");
  }
}
