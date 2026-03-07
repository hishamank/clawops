export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { events, type DB } from "@clawops/core";
import { TaskPriority, TaskStatus, Source } from "@clawops/domain";
import { createTask, listTasks } from "@clawops/tasks";
import { getDb, jsonError, parseSearch } from "@/lib/server/runtime";

const taskStatusEnum = z.nativeEnum(TaskStatus);
const taskPriorityEnum = z.nativeEnum(TaskPriority);
const taskSourceEnum = z.nativeEnum(Source);

const createTaskBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  assigneeId: z.string().optional(),
  projectId: z.string().optional(),
  source: taskSourceEnum.optional(),
  dueDate: z.string().datetime().optional(),
  specContent: z.string().optional(),
});

const listTasksQuery = z.object({
  status: taskStatusEnum.optional(),
  assigneeId: z.string().optional(),
  projectId: z.string().optional(),
  priority: taskPriorityEnum.optional(),
  withSpecs: z.string().transform((v) => v === "true").optional(),
});

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const filters = parseSearch(req, listTasksQuery);
    return NextResponse.json(listTasks(getDb(), filters));
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to list tasks", "INTERNAL_ERROR");
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = createTaskBody.parse(await req.json());
    const db = getDb();
    const task = db.transaction((tx) => {
      const t = createTask(tx as unknown as DB, {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        specContent: body.specContent,
        specUpdatedAt: body.specContent ? new Date() : undefined,
      });
      tx.insert(events)
        .values({
          action: "task.created",
          entityType: "task",
          entityId: t.id,
          meta: JSON.stringify({ title: t.title }),
        })
        .run();
      return t;
    });
    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to create task", "INTERNAL_ERROR");
  }
}
