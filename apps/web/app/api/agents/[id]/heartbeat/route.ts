export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { events, type DB } from "@clawops/core";
import { getAgent, updateAgentStatus } from "@clawops/agents";
import { logHeartbeat } from "@clawops/habits";
import { AgentStatus } from "@clawops/domain";
import { NextResponse } from "next/server";
import { getDb, jsonError, requireAgentId } from "@/lib/server/runtime";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (id !== auth) {
    return jsonError(403, "Forbidden", "FORBIDDEN");
  }

  const db = getDb();
  const agent = getAgent(db, id);
  if (!agent) {
    return jsonError(404, "Agent not found", "NOT_FOUND");
  }

  const run = db.transaction((tx) => {
    const r = logHeartbeat(tx as unknown as DB, id);
    updateAgentStatus(tx as unknown as DB, id, AgentStatus.online);
    tx.insert(events)
      .values({
        id: crypto.randomUUID(),
        agentId: id,
        action: "agent.heartbeat",
        entityType: "agent",
        entityId: id,
        meta: JSON.stringify({ habitRunId: r.id }),
        createdAt: new Date(),
      })
      .run();
    return r;
  });

  return NextResponse.json(run, { status: 201 });
}
