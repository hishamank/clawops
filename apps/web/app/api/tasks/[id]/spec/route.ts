export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, events, tasks, createActivityEvent, type DB } from "@clawops/core";
import { getTaskSpec, setTaskSpec } from "@clawops/tasks";
import { getAgentIdFromApiKey, getDb, jsonError } from "@/lib/server/runtime";

const idParams = z.object({ id: z.string().min(1) });

const setSpecBody = z.object({
  specContent: z.string(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = idParams.parse(await params);
    const spec = getTaskSpec(getDb(), id);
    if (spec === null) {
      const task = getDb().select().from(tasks).where(eq(tasks.id, id)).get();
      if (!task) {
        return jsonError(404, "Task not found", "TASK_NOT_FOUND");
      }
    }
    return NextResponse.json({ spec });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to get task spec", "INTERNAL_ERROR");
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = idParams.parse(await params);
    const body = setSpecBody.parse(await req.json());
    const db = getDb();
    const agentId = getAgentIdFromApiKey(req) ?? undefined;
    const task = db.transaction((tx) => {
      const t = setTaskSpec(tx as unknown as DB, id, body.specContent);
      tx.insert(events)
        .values({
          action: "task.spec_updated",
          entityType: "task",
          entityId: t.id,
          agentId,
          meta: JSON.stringify({ specLength: body.specContent.length }),
        })
        .run();
      createActivityEvent(tx as unknown as DB, {
        source: agentId ? "agent" : "user",
        type: "task.spec_updated",
        title: `Task spec updated: ${t.title}`,
        entityType: "task",
        entityId: t.id,
        projectId: t.projectId ?? undefined,
        taskId: t.id,
        agentId,
        metadata: JSON.stringify({ specLength: body.specContent.length }),
      });
      return t;
    });
    return NextResponse.json(task);
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to set task spec", "INTERNAL_ERROR");
  }
}
