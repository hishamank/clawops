export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { events, createActivityEvent } from "@clawops/core";
import { ProjectStatus } from "@clawops/domain";
import { createProject, listProjects } from "@clawops/projects";
import { getDb, jsonError, requireAgentId } from "@/lib/server/runtime";

const createProjectBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  prd: z.string().optional(),
  ideaId: z.string().optional(),
});

export async function GET(req: Request): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(listProjects(getDb()));
}

export async function POST(req: Request): Promise<NextResponse> {
  const agentId = requireAgentId(req);
  if (agentId instanceof NextResponse) return agentId;

  try {
    const body = createProjectBody.parse(await req.json());
    const db = getDb();
    const project = db.transaction((tx) => {
      const p = createProject(tx, body);
      tx.insert(events)
        .values({
          action: "project.created",
          entityType: "project",
          entityId: p.id,
          agentId,
          meta: JSON.stringify({ name: p.name }),
        })
        .run();
      createActivityEvent(tx, {
        source: "agent",
        type: "project.created",
        title: `Project created: ${p.name}`,
        entityType: "project",
        entityId: p.id,
        projectId: p.id,
        agentId,
        metadata: JSON.stringify({ name: p.name, status: p.status }),
      });
      return p;
    });
    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to create project", "INTERNAL_ERROR");
  }
}
