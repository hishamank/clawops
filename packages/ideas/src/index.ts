import { eq } from "drizzle-orm";
import type { DB, Idea, NewIdea, Project } from "@clawops/core";
import { ideas, projects, parseJsonArray, toJsonArray } from "@clawops/core";
import type { IdeaStatus } from "@clawops/domain";
import { NotFoundError, ConflictError } from "@clawops/domain";

export function createIdea(
  db: DB,
  input: { title: string; description?: string; tags?: string[]; source?: NewIdea["source"] },
): Idea {
  const [idea] = db
    .insert(ideas)
    .values({
      title: input.title,
      description: input.description ?? null,
      tags: input.tags ? toJsonArray(input.tags) : null,
      source: input.source ?? "human",
    })
    .returning()
    .all();
  return idea;
}

export function listIdeas(
  db: DB,
  filters?: { status?: IdeaStatus; tag?: string },
): Idea[] {
  let result: Idea[];

  if (filters?.status) {
    result = db
      .select()
      .from(ideas)
      .where(eq(ideas.status, filters.status))
      .all();
  } else {
    result = db.select().from(ideas).all();
  }

  if (filters?.tag) {
    const tag = filters.tag;
    result = result.filter((idea) => parseJsonArray(idea.tags).includes(tag));
  }

  return result;
}

export function updateIdea(
  db: DB,
  id: string,
  updates: Partial<{
    title: string;
    description: string;
    status: IdeaStatus;
    tags: string[];
  }>,
): Idea {
  const values: Record<string, unknown> = {};
  if (updates.title !== undefined) values["title"] = updates.title;
  if (updates.description !== undefined) values["description"] = updates.description;
  if (updates.status !== undefined) values["status"] = updates.status;
  if (updates.tags !== undefined) values["tags"] = toJsonArray(updates.tags);

  const [idea] = db
    .update(ideas)
    .set(values)
    .where(eq(ideas.id, id))
    .returning()
    .all();
  return idea;
}

export function promoteIdeaToProject(
  db: DB,
  ideaId: string,
): { idea: Idea; project: Project } {
  const [existing] = db
    .select()
    .from(ideas)
    .where(eq(ideas.id, ideaId))
    .all();

  if (!existing) {
    throw new NotFoundError(`Idea not found: ${ideaId}`);
  }

  if (existing.status === "promoted" || existing.projectId) {
    throw new ConflictError(`Idea "${ideaId}" is already promoted`);
  }

  const tags = parseJsonArray(existing.tags);
  const description = tags.length > 0
    ? `${existing.description ?? ""}\n\nTags: ${tags.join(", ")}`.trim()
    : existing.description ?? undefined;

  return db.transaction((tx) => {
    const [project] = tx
      .insert(projects)
      .values({
        name: existing.title,
        description: description ?? null,
        ideaId: existing.id,
      })
      .returning()
      .all();

    const [idea] = tx
      .update(ideas)
      .set({ status: "promoted", projectId: project.id })
      .where(eq(ideas.id, ideaId))
      .returning()
      .all();

    return { idea, project };
  });
}
