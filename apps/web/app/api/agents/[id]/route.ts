export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { tasks, eq, desc } from "@clawops/core";
import { getAgent } from "@clawops/agents";
import { getHabitStreak, listHabits } from "@clawops/habits";
import { getDb, jsonError } from "@/lib/server/runtime";

const idParams = z.object({ id: z.string().min(1) });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = idParams.parse(await params);
    const db = getDb();
    const agent = getAgent(db, id);
    if (!agent) {
      return jsonError(404, "Agent not found", "NOT_FOUND");
    }

    const { apiKey: _apiKey, ...safeAgent } = agent;
    const recentTasks = db
      .select()
      .from(tasks)
      .where(eq(tasks.assigneeId, id))
      .orderBy(desc(tasks.createdAt))
      .limit(10)
      .all();

    const habits = listHabits(db, id);
    const habitsWithStreaks = habits.map((h) => ({
      ...h,
      streaks: getHabitStreak(db, h.id, 7),
    }));

    return NextResponse.json({
      ...safeAgent,
      recentTasks,
      habits: habitsWithStreaks,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }
    return jsonError(500, err instanceof Error ? err.message : "Failed to get agent", "INTERNAL_ERROR");
  }
}
