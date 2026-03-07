export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { events, type DB } from "@clawops/core";
import { ProjectStatus } from "@clawops/domain";
import { getProject, updateProject } from "@clawops/projects";
import { getAgentIdFromApiKey, getDb, jsonError } from "@/lib/server/runtime";

const idParams = z.object({ id: z.string().min(1) });
const updateProjectBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  prd: z.string().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = idParams.parse(await params);
  const project = getProject(getDb(), id);
  if (!project) return jsonError(404, "Not found", "NOT_FOUND");
  return NextResponse.json(project);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = idParams.parse(await params);
    const body = updateProjectBody.parse(await req.json());
    const db = getDb();
    const agentId = getAgentIdFromApiKey(req) ?? undefined;
    const existing = getProject(db, id);
    if (!existing) return jsonError(404, "Not found", "NOT_FOUND");

    const project = db.transaction((tx) => {
      const p = updateProject(tx as unknown as DB, id, body);
      tx.insert(events)
        .values({
          action: "project.updated",
          entityType: "project",
          entityId: p.id,
          agentId,
          meta: JSON.stringify({ fields: Object.keys(body) }),
        })
        .run();
      return p;
    });
    return NextResponse.json(project);
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to update project", "INTERNAL_ERROR");
  }
}
