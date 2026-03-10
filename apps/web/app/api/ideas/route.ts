export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { events, type DB } from "@clawops/core";
import { ConflictError, IdeaStatus, NotFoundError, Source } from "@clawops/domain";
import { createIdea, listIdeas } from "@clawops/ideas";
import { getDb, jsonError, parseSearch } from "@/lib/server/runtime";

const sectionSchema = z.object({
  brainstorming: z.string().optional(),
  research: z.string().optional(),
  similarIdeas: z.string().optional(),
  draftPrd: z.string().optional(),
  notes: z.string().optional(),
}).strict();

const createIdeaBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sections: sectionSchema.optional(),
  source: z.enum([Source.human, Source.agent]).optional(),
});

const listIdeasQuery = z.object({
  status: z.nativeEnum(IdeaStatus).optional(),
  tag: z.string().optional(),
});

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const filters = parseSearch(req, listIdeasQuery);
    return NextResponse.json(listIdeas(getDb(), filters));
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to list ideas", "INTERNAL_ERROR");
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = createIdeaBody.parse(await req.json());
    const db = getDb();
    const idea = db.transaction((tx) => {
      const i = createIdea(tx as unknown as DB, body);
      tx.insert(events)
        .values({
          action: "idea.created",
          entityType: "idea",
          entityId: i.id,
          meta: JSON.stringify({ title: i.title }),
        })
        .run();
      return i;
    });
    return NextResponse.json(idea, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    if (err instanceof NotFoundError) return jsonError(404, err.message, err.code);
    if (err instanceof ConflictError) return jsonError(409, err.message, err.code);
    return jsonError(500, err instanceof Error ? err.message : "Failed to create idea", "INTERNAL_ERROR");
  }
}
