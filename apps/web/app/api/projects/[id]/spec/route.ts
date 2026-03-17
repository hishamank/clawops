export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { events, createActivityEvent, type DB } from "@clawops/core";
import { getProject, getProjectSpec, setProjectSpec, appendProjectSpec } from "@clawops/projects";
import { getDb, jsonError, requireAgentId } from "@/lib/server/runtime";

const idParams = z.object({ id: z.string().min(1) });
const setSpecBody = z.object({
  specContent: z.string(),
});
const appendSpecBody = z.object({
  content: z.string(),
});

// GET /api/projects/:id/spec - Get project spec
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = idParams.parse(await params);
    const db = getDb();
    const project = getProject(db, id);
    if (!project) return jsonError(404, "Project not found", "NOT_FOUND");

    const spec = getProjectSpec(db, id);
    return NextResponse.json({
      spec,
      specUpdatedAt: project.specUpdatedAt,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to get spec", "INTERNAL_ERROR");
  }
}

// PUT /api/projects/:id/spec - Set/replace full spec
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const agentId = requireAgentId(req);
  if (agentId instanceof NextResponse) return agentId;

  try {
    const { id } = idParams.parse(await params);
    const body = setSpecBody.parse(await req.json());
    const db = getDb();

    const project = getProject(db, id);
    if (!project) return jsonError(404, "Project not found", "NOT_FOUND");

    const updatedProject = db.transaction((tx) => {
      const p = setProjectSpec(tx as unknown as DB, id, body.specContent);
      tx.insert(events)
        .values({
          action: "project.spec_updated",
          entityType: "project",
          entityId: p.id,
          agentId,
          meta: JSON.stringify({ specLength: body.specContent.length }),
        })
        .run();
      createActivityEvent(tx as unknown as DB, {
        source: "agent",
        type: "project.spec_updated",
        title: `Project spec updated: ${project.name}`,
        entityType: "project",
        entityId: p.id,
        projectId: p.id,
        agentId,
        metadata: JSON.stringify({ specLength: body.specContent.length }),
      });
      return p;
    });

    return NextResponse.json({
      spec: updatedProject.specContent,
      specUpdatedAt: updatedProject.specUpdatedAt,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to set spec", "INTERNAL_ERROR");
  }
}

// POST /api/projects/:id/spec/append - Append content to spec
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const agentId = requireAgentId(req);
  if (agentId instanceof NextResponse) return agentId;

  try {
    const { id } = idParams.parse(await params);
    const body = appendSpecBody.parse(await req.json());
    const db = getDb();

    const project = getProject(db, id);
    if (!project) return jsonError(404, "Project not found", "NOT_FOUND");

    const updatedProject = db.transaction((tx) => {
      const p = appendProjectSpec(tx as unknown as DB, id, body.content);
      tx.insert(events)
        .values({
          action: "project.spec_appended",
          entityType: "project",
          entityId: p.id,
          agentId,
          meta: JSON.stringify({ appendedLength: body.content.length }),
        })
        .run();
      createActivityEvent(tx as unknown as DB, {
        source: "agent",
        type: "project.spec_appended",
        title: `Project spec appended: ${project.name}`,
        entityType: "project",
        entityId: p.id,
        projectId: p.id,
        agentId,
        metadata: JSON.stringify({ appendedLength: body.content.length }),
      });
      return p;
    });

    return NextResponse.json({
      spec: updatedProject.specContent,
      specUpdatedAt: updatedProject.specUpdatedAt,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to append spec", "INTERNAL_ERROR");
  }
}
