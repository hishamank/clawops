import { eq, and } from "drizzle-orm";
import type { DB, Idea, NewIdea, Project, Task, NewTask } from "@clawops/core";
import { ideas, projects, tasks, parseJsonArray, toJsonArray, parseJsonObject, toJsonObject } from "@clawops/core";
import type { IdeaStatus, TaskStatus, TaskPriority, Source } from "@clawops/domain";
import { NotFoundError, ConflictError } from "@clawops/domain";

export const IDEA_SECTION_KEYS = [
  "brainstorming",
  "research",
  "similarIdeas",
  "draftPrd",
  "notes",
] as const;

export type IdeaSectionKey = (typeof IDEA_SECTION_KEYS)[number];

/**
 * Structured sections for idea incubation
 */
export type IdeaSections = Partial<Record<IdeaSectionKey, string>>;

function getIdeaSectionsRow(db: DB, id: string): { sections: string | null } {
  const [idea] = db
    .select({ sections: ideas.sections })
    .from(ideas)
    .where(eq(ideas.id, id))
    .all();

  if (!idea) {
    throw new NotFoundError(`Idea not found: ${id}`);
  }

  return idea;
}

export function createIdea(
  db: DB,
  input: { title: string; description?: string; tags?: string[]; sections?: IdeaSections; source?: NewIdea["source"] },
): Idea {
  const [idea] = db
    .insert(ideas)
    .values({
      title: input.title,
      description: input.description ?? null,
      tags: input.tags ? toJsonArray(input.tags) : null,
      sections: input.sections ? toJsonObject(input.sections) : null,
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
    sections: IdeaSections;
  }>,
): Idea {
  const values: Record<string, unknown> = {};
  if (updates.title !== undefined) values["title"] = updates.title;
  if (updates.description !== undefined) values["description"] = updates.description;
  if (updates.status !== undefined) values["status"] = updates.status;
  if (updates.tags !== undefined) values["tags"] = toJsonArray(updates.tags);
  if (updates.sections !== undefined) values["sections"] = toJsonObject(updates.sections);

  const [idea] = db
    .update(ideas)
    .set(values)
    .where(eq(ideas.id, id))
    .returning()
    .all();
  return idea;
}

/**
 * Get all sections for an idea
 */
export function getIdeaSections(db: DB, id: string): IdeaSections {
  const idea = getIdeaSectionsRow(db, id);
  if (!idea.sections) {
    return {};
  }
  return parseJsonObject(idea.sections) as IdeaSections;
}

/**
 * Get a specific section from an idea
 */
export function getIdeaSection(db: DB, id: string, section: IdeaSectionKey): string | null {
  const sections = getIdeaSections(db, id);
  return sections[section] ?? null;
}

/**
 * Update a specific section of an idea
 */
export function updateIdeaSection(
  db: DB,
  id: string,
  section: IdeaSectionKey,
  content: string,
): Idea {
  const existingSections = getIdeaSections(db, id);
  const updatedSections = { ...existingSections, [section]: content };

  const [idea] = db
    .update(ideas)
    .set({ sections: toJsonObject(updatedSections) })
    .where(eq(ideas.id, id))
    .returning()
    .all();

  if (!idea) {
    throw new NotFoundError(`Idea not found: ${id}`);
  }

  return idea;
}

/**
 * Update multiple sections of an idea at once
 */
export function updateIdeaSections(
  db: DB,
  id: string,
  sections: Partial<IdeaSections>,
): Idea {
  const existingSections = getIdeaSections(db, id);
  const updatedSections = { ...existingSections, ...sections };

  const [idea] = db
    .update(ideas)
    .set({ sections: toJsonObject(updatedSections) })
    .where(eq(ideas.id, id))
    .returning()
    .all();

  if (!idea) {
    throw new NotFoundError(`Idea not found: ${id}`);
  }

  return idea;
}

/**
 * Get the draft PRD content from an idea
 */
export function getIdeaDraftPrd(db: DB, id: string): string | null {
  return getIdeaSection(db, id, "draftPrd");
}

/**
 * Set the draft PRD content for an idea
 */
export function setIdeaDraftPrd(db: DB, id: string, content: string): Idea {
  return updateIdeaSection(db, id, "draftPrd", content);
}

/**
 * List all tasks linked to an idea
 */
export function listIdeaTasks(
  db: DB,
  ideaId: string,
  filters?: { status?: TaskStatus },
): Task[] {
  const conditions = [eq(tasks.ideaId, ideaId)];

  if (filters?.status) {
    conditions.push(eq(tasks.status, filters.status));
  }

  return db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .all();
}

/**
 * Create a task linked to an idea
 */
export function createIdeaTask(
  db: DB,
  ideaId: string,
  input: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    assigneeId?: string;
    source?: Source;
    dueDate?: Date;
  },
): Task {
  // Verify idea exists
  const [idea] = db
    .select({ id: ideas.id })
    .from(ideas)
    .where(eq(ideas.id, ideaId))
    .all();

  if (!idea) {
    throw new NotFoundError(`Idea not found: ${ideaId}`);
  }

  const [task] = db
    .insert(tasks)
    .values({
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? "medium",
      assigneeId: input.assigneeId ?? null,
      source: input.source ?? "human",
      dueDate: input.dueDate ?? null,
      ideaId,
    })
    .returning()
    .all();

  return task;
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

    // Migrate any existing idea-linked tasks to the new project
    tx
      .update(tasks)
      .set({ projectId: project.id })
      .where(eq(tasks.ideaId, ideaId))
      .run();

    return { idea, project };
  });
}
