export const dynamic = "force-dynamic";

import { events } from "@clawops/core";
import { getAgentByApiKey } from "@clawops/agents";
import { hashApiKey } from "@clawops/domain";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, jsonError } from "@/lib/server/runtime";

const loginBody = z.object({ apiKey: z.string().min(1) });

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const { apiKey } = loginBody.parse(await req.json());
    const db = getDb();
    const agent = getAgentByApiKey(db, hashApiKey(apiKey));
    if (!agent) {
      return jsonError(401, "Invalid API key", "UNAUTHORIZED");
    }

    db.insert(events)
      .values({
        action: "auth.login",
        entityType: "agent",
        entityId: agent.id,
        agentId: agent.id,
        meta: JSON.stringify({ name: agent.name }),
      })
      .run();

    return NextResponse.json({
      id: agent.id,
      name: agent.name,
      model: agent.model,
      role: agent.role,
      status: agent.status,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }
    return jsonError(500, err instanceof Error ? err.message : "Login failed", "INTERNAL_ERROR");
  }
}
