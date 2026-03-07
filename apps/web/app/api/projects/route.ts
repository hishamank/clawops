export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { events, type DB } from "@clawops/core";
import { ProjectStatus } from "@clawops/domain";
import { createProject, listProjects } from "@clawops/projects";
import { getAgentIdFromApiKey, getDb, jsonError } from "@/lib/server/runtime";

const createProjectBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  prd: z.string().optional(),
  ideaId: z.string().optional(),
});

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(listProjects(getDb()));
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = createProjectBody.parse(await req.json());
    const db = getDb();
    const agentId = getAgentIdFromApiKey(req) ?? undefined;
    const project = db.transaction((tx) => {
      const p = createProject(tx as unknown as DB, body);
      tx.insert(events)
        .values({
          action: "project.created",
          entityType: "project",
          entityId: p.id,
          agentId,
          meta: JSON.stringify({ name: p.name }),
        })
        .run();
      return p;
    });
    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to create project", "INTERNAL_ERROR");
  }
}
