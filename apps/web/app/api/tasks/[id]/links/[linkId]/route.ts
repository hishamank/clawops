export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { events, createActivityEvent } from "@clawops/core";
import { removeTaskResourceLink, getTask } from "@clawops/tasks";
import { getAgentIdFromApiKey, getDb, jsonError } from "@/lib/server/runtime";
import { serializeLink } from "../utils";

const paramsSchema = z.object({
  id: z.string().min(1),
  linkId: z.string().min(1),
});

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> },
): Promise<NextResponse> {
  try {
    const { id, linkId } = paramsSchema.parse(await params);
    const db = getDb();
    const task = getTask(db, id);
    if (!task) return jsonError(404, "Task not found", "TASK_NOT_FOUND");
    const agentId = getAgentIdFromApiKey(req) ?? undefined;
    const removed = db.transaction((tx) => {
      const link = removeTaskResourceLink(tx, id, linkId);
      if (!link) return null;
      const metadata = {
        linkId: link.id,
        provider: link.provider,
        resourceType: link.resourceType,
        url: link.url,
      };
      tx.insert(events)
        .values({
          action: "task.link.removed",
          entityType: "task",
          entityId: id,
          agentId,
          meta: JSON.stringify(metadata),
        })
        .run();
      createActivityEvent(tx, {
        source: agentId ? "agent" : "user",
        type: "task.link.removed",
        title: `Link removed from task: ${task.title}`,
        entityType: "task",
        entityId: id,
        projectId: task.projectId ?? undefined,
        taskId: id,
        agentId,
        metadata: JSON.stringify(metadata),
      });
      return link;
    });
    if (!removed) return jsonError(404, "Resource link not found", "RESOURCE_LINK_NOT_FOUND");
    return NextResponse.json(serializeLink(removed));
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to remove resource link",
      "INTERNAL_ERROR",
    );
  }
}
