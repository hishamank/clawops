export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { events, createActivityEvent } from "@clawops/core";
import { listTaskRelations, createTaskRelation } from "@clawops/tasks";
import { getAgentIdFromApiKey, getDb, jsonError } from "@/lib/server/runtime";

const idParams = z.object({ id: z.string().min(1) });

const createRelationBody = z.object({
  targetTaskId: z.string().min(1),
  type: z.enum(["blocks", "depends-on", "related-to"]),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = idParams.parse(await params);
  const relations = listTaskRelations(getDb(), id);
  return NextResponse.json(relations);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = idParams.parse(await params);
    const body = createRelationBody.parse(await req.json());
    const db = getDb();
    const agentId = getAgentIdFromApiKey(req) ?? undefined;
    const relation = db.transaction((tx) => {
      const r = createTaskRelation(tx, {
        fromTaskId: id,
        toTaskId: body.targetTaskId,
        type: body.type,
      });
      tx.insert(events)
        .values({
          action: "task.relation.created",
          entityType: "task",
          entityId: id,
          agentId,
          meta: JSON.stringify({ relationId: r.id, targetTaskId: body.targetTaskId, type: body.type }),
        })
        .run();
      createActivityEvent(tx, {
        source: agentId ? "agent" : "user",
        type: "task.relation.created",
        title: `Task relation created: ${body.type}`,
        entityType: "task",
        entityId: id,
        taskId: id,
        agentId,
        metadata: JSON.stringify({ relationId: r.id, targetTaskId: body.targetTaskId, type: body.type }),
      });
      return r;
    });
    return NextResponse.json(relation, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to create relation", "INTERNAL_ERROR");
  }
}
