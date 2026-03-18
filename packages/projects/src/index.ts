import { eq, and, count } from "drizzle-orm";
import type { DBOrTx } from "@clawops/core";
import {
  projects,
  milestones,
  tasks,
  agentSessions,
  type Project,
  type Milestone,
  type AgentSession,
} from "@clawops/core";
import type { ProjectStatus, MilestoneStatus } from "@clawops/domain";

// ── Project Spec ──────────────────────────────────────────────────────────────

export function getProjectSpec(db: DBOrTx, id: string): string | null {
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  return project?.specContent ?? null;
}

export function setProjectSpec(
  db: DBOrTx,
  id: string,
  specContent: string,
): Project {
  const project = db
    .update(projects)
    .set({
      specContent,
      specUpdatedAt: new Date(),
    })
    .where(eq(projects.id, id))
    .returning()
    .get();
  return project;
}

export function appendProjectSpec(
  db: DBOrTx,
  id: string,
  content: string,
): Project {
  const existing = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!existing) {
    throw new Error(`Project not found: ${id}`);
  }
  const currentSpec = existing.specContent ?? "";
  const newSpec = currentSpec
    ? `${currentSpec}\n\n${content}`
    : content;
  const project = db
    .update(projects)
    .set({
      specContent: newSpec,
      specUpdatedAt: new Date(),
    })
    .where(eq(projects.id, id))
    .returning()
    .get();
  return project;
}

export function createProject(
  db: DBOrTx,
  input: { name: string; description?: string; status?: ProjectStatus; prd?: string; ideaId?: string; repoUrl?: string; directoryPath?: string },
): Project {
  const project = db
    .insert(projects)
    .values({
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? "planning",
      prd: input.prd ?? null,
      prdUpdatedAt: input.prd ? new Date() : null,
      ideaId: input.ideaId ?? null,
      repoUrl: input.repoUrl ?? null,
      directoryPath: input.directoryPath ?? null,
    })
    .returning()
    .get();
  return project;
}

export function getProject(
  db: DBOrTx,
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

export function listProjects(db: DBOrTx): Project[] {
  return db.select().from(projects).all();
}

export function updateProject(
  db: DBOrTx,
  id: string,
  updates: Partial<{ name: string; description: string; status: ProjectStatus; prd: string; repoUrl: string; directoryPath: string }>,
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
  db: DBOrTx,
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
  db: DBOrTx,
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
  db: DBOrTx,
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
  db: DBOrTx,
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

// ── Project Context ──────────────────────────────────────────────────────────

export interface ProjectContext {
  project: {
    id: string;
    name: string;
    status: string;
    goal: string | null;
    spec: string | null;
  };
  openTasks: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
  }>;
  inProgressTasks: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
  }>;
  blockers: Array<{
    id: string;
    title: string;
    description: string | null;
  }>;
  lastSessionSummary: string | null;
}

export function getProjectContext(
  db: DBOrTx,
  projectId: string,
  options?: { minimal?: boolean },
): ProjectContext | null {
  const project = db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

  if (!project) return null;

  // Get last session summary for this project
  const lastSession = db
    .select()
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.projectId, projectId),
        eq(agentSessions.status, "inactive"),
      ),
    )
    .orderBy(agentSessions.endedAt)
    .get();

  const lastSessionSummary = lastSession?.lastSessionSummary ?? null;

  // Get open tasks (todo + in-progress, not done/cancelled)
  const openTasksResult = db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.status, "todo"),
      ),
    )
    .all();

  const openTasks = openTasksResult.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    status: t.status,
  }));

  // Get in-progress tasks
  const inProgressTasksResult = db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.status, "in-progress"),
      ),
    )
    .all();

  const inProgressTasks = inProgressTasksResult.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    status: t.status,
  }));

  // Blockers: tasks that are blocked (we'll use high/urgent priority + in-progress as proxy)
  // In a more sophisticated system, this could be a separate field
  const blockersResult = db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.priority, "urgent"),
        eq(tasks.status, "in-progress"),
      ),
    )
    .all();

  const blockers = blockersResult.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
  }));

  // Minimal mode: only goal + open task titles
  if (options?.minimal) {
    return {
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        goal: project.description ?? null,
        spec: project.specContent ?? null,
      },
      openTasks: openTasks.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        status: t.status,
      })),
      inProgressTasks: [],
      blockers: [],
      lastSessionSummary: null,
    };
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      goal: project.description ?? null,
      spec: project.specContent ?? null,
    },
    openTasks,
    inProgressTasks,
    blockers,
    lastSessionSummary,
  };
}

// ── Session Management ───────────────────────────────────────────────────────

export function activateProject(
  db: DBOrTx,
  agentId: string,
  projectId: string,
): AgentSession {
  // Deactivate any existing active session for this agent
  const existingSession = db
    .select()
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.agentId, agentId),
        eq(agentSessions.status, "active"),
      ),
    )
    .get();

  if (existingSession) {
    db.update(agentSessions)
      .set({
        status: "inactive",
        endedAt: new Date(),
      })
      .where(eq(agentSessions.id, existingSession.id))
      .run();
  }

  // Create new active session
  const session = db
    .insert(agentSessions)
    .values({
      agentId,
      projectId,
      status: "active",
    })
    .returning()
    .get();

  return session;
}

export function deactivateProject(
  db: DBOrTx,
  agentId: string,
  summary: string,
): AgentSession | null {
  const session = db
    .select()
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.agentId, agentId),
        eq(agentSessions.status, "active"),
      ),
    )
    .get();

  if (!session) return null;

  const updated = db
    .update(agentSessions)
    .set({
      status: "inactive",
      endedAt: new Date(),
      lastSessionSummary: summary,
    })
    .where(eq(agentSessions.id, session.id))
    .returning()
    .get();

  return updated;
}

export function getActiveSession(
  db: DBOrTx,
  agentId: string,
): AgentSession | null {
  const session = db
    .select()
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.agentId, agentId),
        eq(agentSessions.status, "active"),
      ),
    )
    .get() ?? null;

  return session;
}
