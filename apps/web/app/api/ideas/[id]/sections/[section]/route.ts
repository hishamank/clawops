export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { events, type DB } from "@clawops/core";
import { getIdeaSection, updateIdeaSection, type IdeaSections } from "@clawops/ideas";
import { NotFoundError } from "@clawops/domain";
import { getDb, jsonError } from "@/lib/server/runtime";
import { z } from "zod";

const updateSectionBody = z.object({
  content: z.string(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; section: keyof IdeaSections }> },
): Promise<NextResponse> {
  const { id, section } = await params;
  try {
    const db = getDb();
    const content = getIdeaSection(db, id, section);
    return NextResponse.json({ section, content });
  } catch (err) {
    if (err instanceof NotFoundError) return jsonError(404, err.message, err.code);
    return jsonError(500, err instanceof Error ? err.message : "Failed to get section", "INTERNAL_ERROR");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; section: keyof IdeaSections }> },
): Promise<NextResponse> {
  const { id, section } = await params;
  try {
    const body = updateSectionBody.parse(await request.json());
    const db = getDb();

    const idea = db.transaction((tx) => {
      const result = updateIdeaSection(tx as unknown as DB, id, section, body.content);
      tx.insert(events)
        .values({
          action: "idea.section_updated",
          entityType: "idea",
          entityId: id,
          meta: JSON.stringify({ section, contentLength: body.content.length }),
        })
        .run();
      return result;
    });

    revalidateTag("ideas");
    return NextResponse.json({ idea });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    if (err instanceof NotFoundError) return jsonError(404, err.message, err.code);
    return jsonError(500, err instanceof Error ? err.message : "Failed to update section", "INTERNAL_ERROR");
  }
}
