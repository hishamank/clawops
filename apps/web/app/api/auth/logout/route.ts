export const dynamic = "force-dynamic";

import { events } from "@clawops/core";
import { NextResponse } from "next/server";
import { getAgentIdFromApiKey, getDb } from "@/lib/server/runtime";

export async function POST(req: Request): Promise<NextResponse> {
  const db = getDb();
  const agentId = getAgentIdFromApiKey(req);
  if (agentId) {
    db.insert(events)
      .values({
        action: "auth.logout",
        entityType: "agent",
        entityId: agentId,
        agentId,
        meta: JSON.stringify({}),
      })
      .run();
  }
  return NextResponse.json({ success: true });
}
