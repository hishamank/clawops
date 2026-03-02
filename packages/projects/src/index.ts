import { eq, and, count } from "drizzle-orm";
import type { DB } from "@clawops/core";
import {
  projects,
  milestones,
  tasks,
  type Project,
  type Milestone,
} from "@clawops/core";
import type { ProjectStatus, MilestoneStatus } from "@clawops/domain";

export async function createProject(
  db: DB,
  input: { name: string; description?: string; status?: ProjectStatus; prd?: string; ideaId?: string },
): Promise<Project> {
  const project = await db
    .insert(projects)
    .values({
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? "planning",
      prd: input.prd ?? null,
      prdUpdatedAt: input.prd ? new Date() : null,
      ideaId: input.ideaId ?? null,
    })
    .returning()
    .get();
  return project;
}

export function getProject(
  db: DB,
  id: string,
): (Project & { milestones: Milestone[]; taskCount: number }) | null {
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) return null;

  const projectMilestones = db
    .select()
    .from(milestones)
    .where(eq(milestones.projectId, id))
    .orderBy(milestones.order)
    .all();

  const taskCountResult = db
    .select({ count: count() })
    .from(tasks)
    .where(eq(tasks.projectId, id))
    .get();

  return {
    ...project,
    milestones: projectMilestones,
    taskCount: taskCountResult?.count ?? 0,
  };
}

export function listProjects(db: DB): Project[] {
  return db.select().from(projects).all();
}

export function updateProject(
  db: DB,
  id: string,
  updates: Partial<{ name: string; description: string; status: ProjectStatus; prd: string }>,
): Project {
  const values: Record<string, unknown> = { ...updates };
  if (updates.prd !== undefined) {
    values["prdUpdatedAt"] = new Date();
  }

  const project = db
    .update(projects)
    .set(values)
    .where(eq(projects.id, id))
    .returning()
    .get();
  return project;
}

// ── Milestones ───────────────────────────────────────────────────────────────

export function createMilestone(
  db: DB,
  projectId: string,
  input: { title: string; order?: number },
): Milestone {
  const order =
    input.order ??
    (db
      .select({ count: count() })
      .from(milestones)
      .where(eq(milestones.projectId, projectId))
      .get()?.count ?? 0);

  const milestone = db
    .insert(milestones)
    .values({
      projectId,
      title: input.title,
      order,
    })
    .returning()
    .get();
  return milestone;
}

export function updateMilestone(
  db: DB,
  id: string,
  updates: Partial<{ title: string; status: MilestoneStatus; order: number }>,
): Milestone {
  const milestone = db
    .update(milestones)
    .set(updates)
    .where(eq(milestones.id, id))
    .returning()
    .get();
  return milestone;
}

export function reorderMilestones(
  db: DB,
  projectId: string,
  orderedIds: string[],
): Milestone[] {
  const results: Milestone[] = [];
  for (let i = 0; i < orderedIds.length; i++) {
    const milestone = db
      .update(milestones)
      .set({ order: i })
      .where(eq(milestones.id, orderedIds[i]))
      .returning()
      .get();
    results.push(milestone);
  }
  return results;
}

// ── Progress ─────────────────────────────────────────────────────────────────

export function getProjectProgress(
  db: DB,
  id: string,
): { total: number; completed: number; percent: number } {
  const totalResult = db
    .select({ count: count() })
    .from(tasks)
    .where(eq(tasks.projectId, id))
    .get();

  const total = totalResult?.count ?? 0;

  const completedResult = db
    .select({ count: count() })
    .from(tasks)
    .where(and(eq(tasks.projectId, id), eq(tasks.status, "done")))
    .get();

  const completed = completedResult?.count ?? 0;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { total, completed, percent };
}
