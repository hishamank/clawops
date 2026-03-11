export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { events, createActivityEvent, type DB } from "@clawops/core";
import { completeTask } from "@clawops/tasks";
import { createNotification } from "@clawops/notifications";
import { getAgentIdFromApiKey, getDb, jsonError } from "@/lib/server/runtime";

const idParams = z.object({ id: z.string().min(1) });

const completeTaskBody = z.object({
  summary: z.string().min(1),
  tokensIn: z.number().int().nonnegative().optional(),
  tokensOut: z.number().int().nonnegative().optional(),
  model: z.string().optional(),
  artifacts: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = idParams.parse(await params);
    const body = completeTaskBody.parse(await req.json());
    const db = getDb();
    const agentId = getAgentIdFromApiKey(req) ?? undefined;
    const task = db.transaction((tx) => {
      const t = completeTask(tx as unknown as DB, id, body);
      if (!t) return null;
      createNotification(tx as unknown as DB, {
        type: "task.completed",
        title: "Task completed",
        body: `Task "${t.title}" has been completed.`,
        entityType: "task",
        entityId: t.id,
      });
      tx.insert(events)
        .values({
          action: "task.completed",
          entityType: "task",
          entityId: t.id,
          agentId,
          meta: JSON.stringify({ summary: body.summary }),
        })
        .run();
      createActivityEvent(tx as unknown as DB, {
        source: agentId ? "agent" : "user",
        type: "task.completed",
        title: `Task completed: ${t.title}`,
        entityType: "task",
        entityId: t.id,
        projectId: t.projectId ?? undefined,
        taskId: t.id,
        agentId,
        metadata: JSON.stringify({ summary: body.summary, model: body.model }),
      });
      return t;
    });
    if (!task) return jsonError(404, "Task not found", "TASK_NOT_FOUND");
    return NextResponse.json(task);
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to complete task", "INTERNAL_ERROR");
  }
}
