export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { events } from "@clawops/core";
import { logHabitRun } from "@clawops/habits";
import { getDb, jsonError, isNotFoundError, requireAgentId } from "@/lib/server/runtime";

const habitRunSchema = z.object({
  success: z.boolean(),
  note: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const body = habitRunSchema.parse(await req.json());
    const db = getDb();
    const run = db.transaction((tx) => {
      const r = logHabitRun(tx, id, auth, body);
      tx.insert(events)
        .values({
          id: crypto.randomUUID(),
          agentId: auth,
          action: "habit.run_logged",
          entityType: "habitRun",
          entityId: r.id,
          meta: JSON.stringify({ habitId: id, success: body.success }),
          createdAt: new Date(),
        })
        .run();
      return r;
    });
    return NextResponse.json(run, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    if (isNotFoundError(err)) {
      return jsonError(404, "Habit not found or does not belong to agent", "NOT_FOUND");
    }
    return jsonError(500, err instanceof Error ? err.message : "Failed to run habit", "INTERNAL_ERROR");
  }
}
