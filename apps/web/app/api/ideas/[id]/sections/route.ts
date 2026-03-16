export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { events, createActivityEvent, type DB } from "@clawops/core";
import { getIdeaSections, updateIdeaSections } from "@clawops/ideas";
import { NotFoundError } from "@clawops/domain";
import { getDb, jsonError, requireAgentId } from "@/lib/server/runtime";
import { z } from "zod";

const sectionSchema = z.object({
  brainstorming: z.string().optional(),
  research: z.string().optional(),
  similarIdeas: z.string().optional(),
  draftPrd: z.string().optional(),
  notes: z.string().optional(),
}).strict();

const updateSectionsBody = z.object({
  sections: sectionSchema.partial(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = requireAgentId(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const db = getDb();
    const sections = getIdeaSections(db, id);
    return NextResponse.json({ sections });
  } catch (err) {
    if (err instanceof NotFoundError) return jsonError(404, err.message, err.code);
    return jsonError(500, err instanceof Error ? err.message : "Failed to get sections", "INTERNAL_ERROR");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const agentId = requireAgentId(request);
  if (agentId instanceof NextResponse) return agentId;

  const { id } = await params;
  try {
    const body = updateSectionsBody.parse(await request.json());
    const db = getDb();

    const idea = db.transaction((tx) => {
      const result = updateIdeaSections(tx as unknown as DB, id, body.sections);
      tx.insert(events)
        .values({
          action: "idea.sections_updated",
          entityType: "idea",
          entityId: id,
          agentId,
          meta: JSON.stringify({ updatedSections: Object.keys(body.sections) }),
        })
        .run();
      try {
        createActivityEvent(tx as unknown as DB, {
          source: "agent",
          type: "idea.updated",
          title: `Idea sections updated: ${result.title}`,
          entityType: "idea",
          entityId: id,
          agentId,
          metadata: JSON.stringify({ updatedSections: Object.keys(body.sections) }),
        });
      } catch {
        // best-effort
      }
      return result;
    });

    revalidateTag("ideas");
    return NextResponse.json({ idea });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    if (err instanceof NotFoundError) return jsonError(404, err.message, err.code);
    return jsonError(500, err instanceof Error ? err.message : "Failed to update sections", "INTERNAL_ERROR");
  }
}
