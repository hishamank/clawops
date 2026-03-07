export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { events, type DB } from "@clawops/core";
import { promoteIdeaToProject } from "@clawops/ideas";
import { ConflictError, NotFoundError } from "@clawops/domain";
import { getDb, jsonError } from "@/lib/server/runtime";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const db = getDb();
  try {
    const result = db.transaction((tx) => {
      const r = promoteIdeaToProject(tx as unknown as DB, id);
      tx.insert(events)
        .values({
          action: "idea.promoted",
          entityType: "idea",
          entityId: r.idea.id,
          meta: JSON.stringify({ projectId: r.project.id }),
        })
        .run();
      tx.insert(events)
        .values({
          action: "project.created",
          entityType: "project",
          entityId: r.project.id,
          meta: JSON.stringify({ name: r.project.name, ideaId: r.idea.id }),
        })
        .run();
      return r;
    });

    revalidateTag("ideas");
    revalidateTag("projects");
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NotFoundError) return jsonError(404, err.message, err.code);
    if (err instanceof ConflictError) return jsonError(409, err.message, err.code);
    return jsonError(500, err instanceof Error ? err.message : "Failed to promote idea", "INTERNAL_ERROR");
  }
}
