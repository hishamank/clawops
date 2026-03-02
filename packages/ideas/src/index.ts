import { eq } from "drizzle-orm";
import type { DB, Idea, Project } from "@clawops/core";
import { ideas, parseJsonArray, toJsonArray } from "@clawops/core";
import { createProject } from "@clawops/projects";

export async function createIdea(
  db: DB,
  input: { title: string; description?: string; tags?: string[]; source?: "human" | "agent" },
): Promise<Idea> {
  const [idea] = await db
    .insert(ideas)
    .values({
      title: input.title,
      description: input.description ?? null,
      tags: input.tags ? toJsonArray(input.tags) : null,
      source: input.source ?? "human",
    })
    .returning();
  return idea;
}

export async function listIdeas(
  db: DB,
  filters?: { status?: "raw" | "reviewed" | "promoted" | "archived"; tag?: string },
): Promise<Idea[]> {
  let result: Idea[];

  if (filters?.status) {
    result = await db
      .select()
      .from(ideas)
      .where(eq(ideas.status, filters.status));
  } else {
    result = await db.select().from(ideas);
  }

  if (filters?.tag) {
    const tag = filters.tag;
    result = result.filter((idea) => parseJsonArray(idea.tags).includes(tag));
  }

  return result;
}

export async function updateIdea(
  db: DB,
  id: string,
  updates: Partial<{
    title: string;
    description: string;
    status: "raw" | "reviewed" | "promoted" | "archived";
    tags: string[];
  }>,
): Promise<Idea> {
  const values: Record<string, unknown> = {};
  if (updates.title !== undefined) values["title"] = updates.title;
  if (updates.description !== undefined) values["description"] = updates.description;
  if (updates.status !== undefined) values["status"] = updates.status;
  if (updates.tags !== undefined) values["tags"] = toJsonArray(updates.tags);

  const [idea] = await db
    .update(ideas)
    .set(values)
    .where(eq(ideas.id, id))
    .returning();
  return idea;
}

export async function promoteIdeaToProject(
  db: DB,
  ideaId: string,
): Promise<{ idea: Idea; project: Project }> {
  const [existing] = await db
    .select()
    .from(ideas)
    .where(eq(ideas.id, ideaId));

  if (!existing) {
    throw new Error(`Idea not found: ${ideaId}`);
  }

  const project = await createProject(db, {
    name: existing.title,
    description: existing.description ?? undefined,
    ideaId: existing.id,
  });

  const [idea] = await db
    .update(ideas)
    .set({ status: "promoted", projectId: project.id })
    .where(eq(ideas.id, ideaId))
    .returning();

  return { idea, project };
}
