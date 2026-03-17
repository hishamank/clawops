export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { events, createActivityEvent } from "@clawops/core";
import { deleteTaskRelation } from "@clawops/tasks";
import { getAgentIdFromApiKey, getDb, jsonError } from "@/lib/server/runtime";

const deleteParams = z.object({ id: z.string().min(1), relationId: z.string().min(1) });

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; relationId: string }> },
): Promise<NextResponse> {
  try {
    const { id, relationId } = deleteParams.parse(await params);
    const db = getDb();
    const agentId = getAgentIdFromApiKey(req) ?? undefined;
    db.transaction((tx) => {
      deleteTaskRelation(tx, relationId);
      tx.insert(events)
        .values({
          action: "task.relation.deleted",
          entityType: "task",
          entityId: id,
          agentId,
          meta: JSON.stringify({ relationId }),
        })
        .run();
      createActivityEvent(tx, {
        source: agentId ? "agent" : "user",
        type: "task.relation.deleted",
        title: `Task relation deleted`,
        entityType: "task",
        entityId: id,
        taskId: id,
        agentId,
        metadata: JSON.stringify({ relationId }),
      });
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to delete relation", "INTERNAL_ERROR");
  }
}
