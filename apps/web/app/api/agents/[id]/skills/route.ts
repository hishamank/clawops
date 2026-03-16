export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { events } from "@clawops/core";
import { updateAgentSkills } from "@clawops/agents";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, jsonError, isNotFoundError, requireAgentId } from "@/lib/server/runtime";

const skillsSchema = z.object({ skills: z.array(z.string()) });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (id !== auth) {
    return jsonError(403, "Forbidden", "FORBIDDEN");
  }

  try {
    const body = skillsSchema.parse(await req.json());
    const db = getDb();
    const agent = db.transaction((tx) => {
      const a = updateAgentSkills(tx, id, body.skills);
      tx.insert(events)
        .values({
          id: crypto.randomUUID(),
          agentId: a.id,
          action: "agent.skills_updated",
          entityType: "agent",
          entityId: a.id,
          meta: JSON.stringify({ skills: body.skills }),
          createdAt: new Date(),
        })
        .run();
      return a;
    });
    const { apiKey: _apiKey, ...safe } = agent;
    return NextResponse.json(safe);
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    if (isNotFoundError(err)) return jsonError(404, "Agent not found", "NOT_FOUND");
    return jsonError(500, err instanceof Error ? err.message : "Failed to update skills", "INTERNAL_ERROR");
  }
}
