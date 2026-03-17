export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { events } from "@clawops/core";
import { markAllRead } from "@clawops/notifications";
import { getAgentIdFromApiKey, getDb } from "@/lib/server/runtime";

export async function PATCH(req: Request): Promise<NextResponse> {
  const db = getDb();
  const agentId = getAgentIdFromApiKey(req) ?? undefined;
  db.transaction((tx) => {
    markAllRead(tx);
    tx.insert(events)
      .values({
        action: "notification.read-all",
        entityType: "notification",
        entityId: "all",
        agentId,
        meta: JSON.stringify({}),
      })
      .run();
  });

  return NextResponse.json({ success: true });
}
