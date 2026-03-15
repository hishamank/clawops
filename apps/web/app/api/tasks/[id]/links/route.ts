export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { events, createActivityEvent, type DB } from "@clawops/core";
import {
  addTaskResourceLink,
  listTaskResourceLinks,
  getTask,
} from "@clawops/tasks";
import { getAgentIdFromApiKey, getDb, jsonError } from "@/lib/server/runtime";
import { serializeLink } from "./utils";

const idParams = z.object({ id: z.string().min(1) });

const addLinkBody = z.object({
  provider: z.string().min(1),
  resourceType: z.string().min(1),
  url: z.string().url(),
  label: z.string().optional(),
  externalId: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = idParams.parse(await params);
    const db = getDb();
    const task = getTask(db, id);
    if (!task) return jsonError(404, "Task not found", "TASK_NOT_FOUND");
    const links = listTaskResourceLinks(db, id);
    return NextResponse.json(links.map(serializeLink));
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to list links", "INTERNAL_ERROR");
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = idParams.parse(await params);
    const body = addLinkBody.parse(await req.json());
    const db = getDb();
    const task = getTask(db, id);
    if (!task) return jsonError(404, "Task not found", "TASK_NOT_FOUND");
    const agentId = getAgentIdFromApiKey(req) ?? undefined;
    const link = db.transaction((tx) => {
      const created = addTaskResourceLink(tx as unknown as DB, id, body);
      const metadata = {
        provider: body.provider,
        resourceType: body.resourceType,
        url: body.url,
        label: body.label,
        externalId: body.externalId,
      };
      tx.insert(events)
        .values({
          action: "task.link.added",
          entityType: "task",
          entityId: id,
          agentId,
          meta: JSON.stringify(metadata),
        })
        .run();
      createActivityEvent(tx as unknown as DB, {
        source: agentId ? "agent" : "user",
        type: "task.link.added",
        title: `Link added to task: ${task.title}`,
        entityType: "task",
        entityId: id,
        projectId: task.projectId ?? undefined,
        taskId: id,
        agentId,
        metadata: JSON.stringify(metadata),
      });
      return created;
    });
    return NextResponse.json(serializeLink(link), { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to add link", "INTERNAL_ERROR");
  }
}
