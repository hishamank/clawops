export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { events, type Agent, type DB } from "@clawops/core";
import { createAgent, listAgents } from "@clawops/agents";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, jsonError } from "@/lib/server/runtime";

const registerSchema = z.object({
  name: z.string().min(1),
  model: z.string().min(1),
  role: z.string().min(1),
  framework: z.string().min(1),
  memoryPath: z.string().optional(),
  skills: z.array(z.string()).optional(),
  avatar: z.string().optional(),
});

function stripApiKey(agent: Agent): Omit<Agent, "apiKey"> {
  const { apiKey: _key, ...rest } = agent;
  return rest;
}

export async function GET(): Promise<NextResponse> {
  const db = getDb();
  return NextResponse.json(listAgents(db).map(stripApiKey));
}

// Optional convenience endpoint mirroring /agents/register
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const data = registerSchema.parse(await req.json());
    const db = getDb();
    const result = db.transaction((tx) => {
      const agent = createAgent(tx as unknown as DB, data);
      tx.insert(events)
        .values({
          id: crypto.randomUUID(),
          agentId: agent.id,
          action: "agent.registered",
          entityType: "agent",
          entityId: agent.id,
          meta: JSON.stringify({ name: agent.name }),
          createdAt: new Date(),
        })
        .run();
      return agent;
    });

    return NextResponse.json({ ...stripApiKey(result), apiKey: result.apiKey }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }
    return jsonError(500, err instanceof Error ? err.message : "Failed to register agent", "INTERNAL_ERROR");
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({
    routes: [
      "POST /api/agents/register",
      "GET /api/agents",
      "GET /api/agents/:id",
      "PATCH /api/agents/:id/status",
      "PATCH /api/agents/:id/skills",
      "POST /api/agents/:id/heartbeat",
      "POST /api/agents",
    ],
    hints: {
      recentTasks: "Included in /api/agents/:id",
      habits: "Included in /api/agents/:id",
      streaks: "Included in /api/agents/:id",
    },
  });
}
