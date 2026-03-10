export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { events, type DB } from "@clawops/core";
import { getIdeaDraftPrd, setIdeaDraftPrd } from "@clawops/ideas";
import { NotFoundError } from "@clawops/domain";
import { getDb, jsonError } from "@/lib/server/runtime";
import { z } from "zod";

const updateDraftPrdBody = z.object({
  content: z.string(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  try {
    const db = getDb();
    const content = getIdeaDraftPrd(db, id);
    return NextResponse.json({ draftPrd: content });
  } catch (err) {
    if (err instanceof NotFoundError) return jsonError(404, err.message, err.code);
    return jsonError(500, err instanceof Error ? err.message : "Failed to get draft PRD", "INTERNAL_ERROR");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  try {
    const body = updateDraftPrdBody.parse(await request.json());
    const db = getDb();

    const idea = db.transaction((tx) => {
      const result = setIdeaDraftPrd(tx as unknown as DB, id, body.content);
      tx.insert(events)
        .values({
          action: "idea.draft_prd_updated",
          entityType: "idea",
          entityId: id,
          meta: JSON.stringify({ contentLength: body.content.length }),
        })
        .run();
      return result;
    });

    revalidateTag("ideas");
    return NextResponse.json({ idea });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    if (err instanceof NotFoundError) return jsonError(404, err.message, err.code);
    return jsonError(500, err instanceof Error ? err.message : "Failed to update draft PRD", "INTERNAL_ERROR");
  }
}
