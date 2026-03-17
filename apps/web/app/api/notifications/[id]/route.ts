export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { events } from "@clawops/core";
import { markRead } from "@clawops/notifications";
import { getAgentIdFromApiKey, getDb, jsonError } from "@/lib/server/runtime";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const db = getDb();
  const agentId = getAgentIdFromApiKey(_request) ?? undefined;

  const notification = db.transaction((tx) => {
    const n = markRead(tx, id);
    if (!n) return null;
    tx.insert(events)
      .values({
        action: "notification.read",
        entityType: "notification",
        entityId: n.id,
        agentId,
        meta: JSON.stringify({}),
      })
      .run();
    return n;
  });

  if (!notification) {
    return jsonError(404, "Not found", "NOT_FOUND");
  }

  return NextResponse.json(notification);
}
