export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { events, createActivityEvent } from "@clawops/core";
import { promoteIdeaToProject } from "@clawops/ideas";
import { ConflictError, NotFoundError } from "@clawops/domain";
import { getDb, jsonError, requireAgentId } from "@/lib/server/runtime";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const agentId = requireAgentId(req);
  if (agentId instanceof NextResponse) return agentId;

  const { id } = await params;
  const db = getDb();
  try {
    const result = db.transaction((tx) => {
      const r = promoteIdeaToProject(tx, id);
      tx.insert(events)
        .values({
          action: "idea.promoted",
          entityType: "idea",
          entityId: r.idea.id,
          agentId,
          meta: JSON.stringify({ projectId: r.project.id }),
        })
        .run();
      tx.insert(events)
        .values({
          action: "project.created",
          entityType: "project",
          entityId: r.project.id,
          agentId,
          meta: JSON.stringify({ name: r.project.name, ideaId: r.idea.id }),
        })
        .run();
      createActivityEvent(tx, {
        source: "agent",
        type: "idea.promoted",
        title: `Idea promoted to project: ${r.idea.title}`,
        entityType: "idea",
        entityId: r.idea.id,
        projectId: r.project.id,
        agentId,
        metadata: JSON.stringify({ ideaTitle: r.idea.title, projectId: r.project.id, projectName: r.project.name }),
      });
      createActivityEvent(tx, {
        source: "agent",
        type: "project.created",
        title: `Project created from idea: ${r.project.name}`,
        entityType: "project",
        entityId: r.project.id,
        projectId: r.project.id,
        agentId,
        metadata: JSON.stringify({ name: r.project.name, ideaId: r.idea.id, ideaTitle: r.idea.title }),
      });
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
