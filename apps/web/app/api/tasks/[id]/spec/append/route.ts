export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { events, type DB } from "@clawops/core";
import { appendTaskSpec } from "@clawops/tasks";
import { getDb, jsonError } from "@/lib/server/runtime";

const idParams = z.object({ id: z.string().min(1) });

const appendSpecBody = z.object({
  content: z.string(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = idParams.parse(await params);
    const body = appendSpecBody.parse(await req.json());
    const db = getDb();
    const task = db.transaction((tx) => {
      const t = appendTaskSpec(tx as unknown as DB, id, body.content);
      tx.insert(events)
        .values({
          action: "task.spec_appended",
          entityType: "task",
          entityId: t.id,
          meta: JSON.stringify({ contentLength: body.content.length }),
        })
        .run();
      return t;
    });
    return NextResponse.json(task);
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to append task spec", "INTERNAL_ERROR");
  }
}
