import { eq, and } from "drizzle-orm";
import type { DB, Task, Artifact, ResourceLink } from "@clawops/core";
import { tasks, artifacts, usageLogs, resourceLinks } from "@clawops/core";
import { calcCost } from "@clawops/domain";

// ── createTask ─────────────────────────────────────────────────────────────

interface CreateTaskInput {
  title: string;
  description?: string;
  status?: Task["status"];
  priority?: Task["priority"];
  assigneeId?: string;
  projectId?: string;
  source?: Task["source"];
  dueDate?: Date;
  specContent?: string;
  specUpdatedAt?: Date | null;
  templateId?: string;
  stageId?: string;
  properties?: Record<string, unknown>;
  ideaId?: string;
}

export function createTask(db: DB, input: CreateTaskInput): Task {
  const rows = db
    .insert(tasks)
    .values({
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      assigneeId: input.assigneeId,
      projectId: input.projectId,
      source: input.source,
      dueDate: input.dueDate,
      specContent: input.specContent,
      specUpdatedAt: input.specContent ? new Date() : null,
      templateId: input.templateId,
      stageId: input.stageId,
      properties: input.properties ? JSON.stringify(input.properties) : undefined,
      ideaId: input.ideaId,
    })
    .returning()
    .all();
  return rows[0];
}

// ── getTask ────────────────────────────────────────────────────────────────

export function getTask(
  db: DB,
  id: string,
): (Task & { artifacts: Artifact[] }) | null {
  const task = db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!task) return null;

  const taskArtifacts = db
    .select()
    .from(artifacts)
    .where(eq(artifacts.taskId, id))
    .all();

  return { ...task, artifacts: taskArtifacts };
}

// ── listTasks ──────────────────────────────────────────────────────────────

interface ListTasksFilters {
  status?: Task["status"];
  assigneeId?: string;
  projectId?: string;
  priority?: Task["priority"];
  withSpecs?: boolean;
}

export function listTasks(db: DB, filters?: ListTasksFilters): Task[] {
  const conditions = [];

  if (filters?.status) {
    conditions.push(eq(tasks.status, filters.status));
  }
  if (filters?.assigneeId) {
    conditions.push(eq(tasks.assigneeId, filters.assigneeId));
  }
  if (filters?.projectId) {
    conditions.push(eq(tasks.projectId, filters.projectId));
  }
  if (filters?.priority) {
    conditions.push(eq(tasks.priority, filters.priority));
  }

  if (conditions.length === 0) {
    return db.select().from(tasks).all();
  }

  return db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .all();
}

// ── updateTask ─────────────────────────────────────────────────────────────

interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: Task["status"];
  priority?: Task["priority"];
  assigneeId?: string;
  projectId?: string;
  dueDate?: Date;
  templateId?: string | null;
  stageId?: string | null;
  properties?: Record<string, unknown> | null;
  ideaId?: string | null;
}

export function updateTask(db: DB, id: string, updates: UpdateTaskInput): Task {
  const { properties, ...rest } = updates;
  const setClause: Record<string, unknown> = { ...rest };
  if (properties !== undefined) {
    setClause.properties = properties === null ? null : JSON.stringify(properties);
  }
  const rows = db
    .update(tasks)
    .set(setClause)
    .where(eq(tasks.id, id))
    .returning()
    .all();
  return rows[0];
}

// ── completeTask ───────────────────────────────────────────────────────────

interface CompleteTaskInput {
  summary: string;
  tokensIn?: number;
  tokensOut?: number;
  model?: string;
  artifacts?: Array<{ label: string; value: string }>;
}

export function completeTask(
  db: DB,
  id: string,
  input: CompleteTaskInput,
): Task {
  const rows = db
    .update(tasks)
    .set({
      status: "done",
      completedAt: new Date(),
      summary: input.summary,
    })
    .where(eq(tasks.id, id))
    .returning()
    .all();
  const task = rows[0];

  if (
    input.tokensIn != null &&
    input.tokensOut != null &&
    input.model != null &&
    task.assigneeId != null
  ) {
    const cost = calcCost(input.model, input.tokensIn, input.tokensOut);
    db.insert(usageLogs)
      .values({
        agentId: task.assigneeId,
        taskId: id,
        model: input.model,
        tokensIn: input.tokensIn,
        tokensOut: input.tokensOut,
        cost,
      })
      .run();
  }

  if (input.artifacts && input.artifacts.length > 0) {
    for (const artifact of input.artifacts) {
      db.insert(artifacts)
        .values({
          taskId: id,
          label: artifact.label,
          value: artifact.value,
        })
        .run();
    }
  }

  return task;
}

// ── getTaskSpec ────────────────────────────────────────────────────────────

export function getTaskSpec(db: DB, id: string): string | null {
  const task = db.select().from(tasks).where(eq(tasks.id, id)).get();
  return task?.specContent ?? null;
}

// ── setTaskSpec ────────────────────────────────────────────────────────────

export function setTaskSpec(db: DB, id: string, specContent: string): Task {
  const rows = db
    .update(tasks)
    .set({
      specContent,
      specUpdatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .returning()
    .all();
  return rows[0];
}

// ── appendTaskSpec ─────────────────────────────────────────────────────────

export function appendTaskSpec(
  db: DB,
  id: string,
  content: string,
): Task {
  const task = db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!task) {
    throw new Error(`Task not found: ${id}`);
  }
  const currentSpec = task.specContent ?? "";
  const newSpec = currentSpec
    ? `${currentSpec}\n\n${content}`
    : `${content}`;
  const rows = db
    .update(tasks)
    .set({
      specContent: newSpec,
      specUpdatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .returning()
    .all();
  return rows[0];
}

export {
  createTaskRelation,
  deleteTaskRelation,
  listTaskRelations,
  getBlockersForTask,
  isTaskBlocked,
  type CreateTaskRelationInput,
  type TaskRelationWithTask,
} from "./relations.js";

// ── parseTaskProperties ───────────────────────────────────────────────────

export function parseTaskProperties(task: Task): Record<string, unknown> {
  if (!task.properties) return {};
  try {
    const parsed: unknown = JSON.parse(task.properties);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

export interface AddTaskResourceLinkInput {
  provider: string;
  resourceType: string;
  label?: string;
  url: string;
  externalId?: string;
  meta?: Record<string, unknown>;
}

export function addTaskResourceLink(
  db: DB,
  taskId: string,
  input: AddTaskResourceLinkInput,
): ResourceLink {
  const row = db
    .insert(resourceLinks)
    .values({
      entityType: "task",
      entityId: taskId,
      provider: input.provider,
      resourceType: input.resourceType,
      label: input.label,
      url: input.url,
      externalId: input.externalId,
      meta: input.meta ? JSON.stringify(input.meta) : undefined,
    })
    .returning()
    .get();
  return row;
}

export function listTaskResourceLinks(db: DB, taskId: string): ResourceLink[] {
  return db
    .select()
    .from(resourceLinks)
    .where(and(eq(resourceLinks.entityType, "task"), eq(resourceLinks.entityId, taskId)))
    .orderBy(resourceLinks.createdAt)
    .all();
}

export function removeTaskResourceLink(
  db: DB,
  taskId: string,
  linkId: string,
): ResourceLink | null {
  const deletedRows = db
    .delete(resourceLinks)
    .where(
      and(
        eq(resourceLinks.id, linkId),
        eq(resourceLinks.entityType, "task"),
        eq(resourceLinks.entityId, taskId),
      ),
    )
    .returning()
    .all();
  return deletedRows[0] ?? null;
}
