export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { events } from "@clawops/core";
import { getAgent } from "@clawops/agents";
import { createHabit, listHabits } from "@clawops/habits";
import { HabitStatus, HabitType } from "@clawops/domain";
import { getDb, jsonError, parseSearch, requireAgentId } from "@/lib/server/runtime";

const createHabitSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(HabitType),
  schedule: z.string().optional(),
  cronExpr: z.string().optional(),
  trigger: z.string().optional(),
  status: z.nativeEnum(HabitStatus).optional(),
});

const listQuery = z.object({ agentId: z.string().optional() });

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const { agentId } = parseSearch(req, listQuery);
    return NextResponse.json(listHabits(getDb(), agentId));
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to list habits", "INTERNAL_ERROR");
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = createHabitSchema.parse(await req.json());
    const db = getDb();

    const agent = getAgent(db, auth);
    if (!agent) return jsonError(404, "Agent not found", "NOT_FOUND");

    const habit = db.transaction((tx) => {
      const h = createHabit(tx, auth, body);
      tx.insert(events)
        .values({
          id: crypto.randomUUID(),
          agentId: auth,
          action: "habit.created",
          entityType: "habit",
          entityId: h.id,
          meta: JSON.stringify({ name: h.name, type: h.type }),
          createdAt: new Date(),
        })
        .run();
      return h;
    });

    return NextResponse.json(habit, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to create habit", "INTERNAL_ERROR");
  }
}
