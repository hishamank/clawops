export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { TaskPriority, TaskStatus } from "@clawops/domain";
import { events, createActivityEvent, type DB } from "@clawops/core";
import { getTask, updateTask } from "@clawops/tasks";
import { getDb, jsonError } from "@/lib/server/runtime";

const taskStatusEnum = z.nativeEnum(TaskStatus);
const taskPriorityEnum = z.nativeEnum(TaskPriority);
const idParams = z.object({ id: z.string().min(1) });

const updateTaskBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  assigneeId: z.string().optional(),
  projectId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = idParams.parse(await params);
  const task = getTask(getDb(), id);
  if (!task) return jsonError(404, "Task not found", "TASK_NOT_FOUND");
  return NextResponse.json(task);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = idParams.parse(await params);
    const body = updateTaskBody.parse(await req.json());
    const db = getDb();
    const task = db.transaction((tx) => {
      const t = updateTask(tx as unknown as DB, id, {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      });
      if (!t) return null;
      tx.insert(events)
        .values({
          action: "task.updated",
          entityType: "task",
          entityId: t.id,
          meta: JSON.stringify({ fields: Object.keys(body) }),
        })
        .run();
      createActivityEvent(tx as unknown as DB, {
        source: "user",
        type: "task.updated",
        title: `Task updated: ${t.title}`,
        entityType: "task",
        entityId: t.id,
        projectId: t.projectId ?? undefined,
        taskId: t.id,
        metadata: JSON.stringify({ fields: Object.keys(body), status: body.status, priority: body.priority }),
      });
      return t;
    });
    if (!task) return jsonError(404, "Task not found", "TASK_NOT_FOUND");
    return NextResponse.json(task);
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to update task", "INTERNAL_ERROR");
  }
}
