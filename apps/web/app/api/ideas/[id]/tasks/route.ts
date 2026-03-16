export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { events, createActivityEvent, type DB } from "@clawops/core";
import { TaskPriority, Source } from "@clawops/domain";
import { listIdeaTasks, createIdeaTask } from "@clawops/ideas";
import { getDb, jsonError, parseSearch, requireAgentId } from "@/lib/server/runtime";

const taskPriorityEnum = z.nativeEnum(TaskPriority);
const sourceEnum = z.nativeEnum(Source);

const listTasksQuery = z.object({
  status: z.enum(["backlog", "todo", "in-progress", "review", "done", "cancelled"]).optional(),
});

const createTaskBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: taskPriorityEnum.optional(),
  assigneeId: z.string().optional(),
  source: sourceEnum.optional(),
  dueDate: z.string().datetime().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: ideaId } = await params;
    const filters = parseSearch(req, listTasksQuery);
    return NextResponse.json(listIdeaTasks(getDb(), ideaId, filters));
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to list idea tasks", "INTERNAL_ERROR");
  }
}

export async function POST(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const agentId = requireAgentId(req);
  if (agentId instanceof NextResponse) return agentId;

  try {
    const { id: ideaId } = await params;
    const body = createTaskBody.parse(await req.json());
    const db = getDb();
    const task = db.transaction((tx) => {
      const t = createIdeaTask(tx as unknown as DB, ideaId, {
        title: body.title,
        description: body.description,
        priority: body.priority,
        assigneeId: body.assigneeId,
        source: body.source,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      });
      tx.insert(events)
        .values({
          action: "task.created",
          entityType: "task",
          entityId: t.id,
          agentId,
          meta: JSON.stringify({ title: t.title, ideaId }),
        })
        .run();
      createActivityEvent(tx as unknown as DB, {
        source: "agent",
        type: "task.created",
        title: `Task created: ${t.title}`,
        entityType: "task",
        entityId: t.id,
        taskId: t.id,
        agentId,
        metadata: JSON.stringify({ title: t.title, ideaId, priority: t.priority }),
      });
      return t;
    });
    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to create idea task", "INTERNAL_ERROR");
  }
}
