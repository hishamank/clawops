import { eq, or, and, inArray } from "drizzle-orm";
import { taskRelations, tasks, type DB, type TaskRelation, type Task } from "@clawops/core";

export interface CreateTaskRelationInput {
  fromTaskId: string;
  toTaskId: string;
  type: "blocks" | "depends-on" | "related-to";
}

export interface TaskRelationWithTask {
  relation: TaskRelation;
  task: Task;
  direction: "outgoing" | "incoming";
}

// Partial relation type for queries that only need fromTaskId and toTaskId
interface TaskRelationIds {
  fromTaskId: string;
  toTaskId: string;
}

// SQLite has a default limit of 999 bound parameters for IN clauses.
// We use 900 to provide a safety margin.
const SQLITE_IN_CLAUSE_LIMIT = 900;

function chunkArray<T>(items: readonly T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) {
    throw new Error("chunkSize must be greater than 0");
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export function createTaskRelation(
  db: DB,
  input: CreateTaskRelationInput,
): TaskRelation {
  return db.insert(taskRelations).values(input).returning().get();
}

export function deleteTaskRelation(db: DB, id: string): void {
  db.delete(taskRelations).where(eq(taskRelations.id, id)).run();
}

export function listTaskRelations(
  db: DB,
  taskId: string,
): TaskRelationWithTask[] {
  const relations = db
    .select({
      id: taskRelations.id,
      fromTaskId: taskRelations.fromTaskId,
      toTaskId: taskRelations.toTaskId,
      type: taskRelations.type,
      createdAt: taskRelations.createdAt,
    })
    .from(taskRelations)
    .where(
      or(
        eq(taskRelations.fromTaskId, taskId),
        eq(taskRelations.toTaskId, taskId),
      ),
    )
    .all();

  if (relations.length === 0) {
    return [];
  }

  const otherIdsSet = new Set<string>();
  for (const relation of relations) {
    const otherId =
      relation.fromTaskId === taskId ? relation.toTaskId : relation.fromTaskId;
    otherIdsSet.add(otherId);
  }

  const otherIds = Array.from(otherIdsSet);
  if (otherIds.length === 0) {
    return [];
  }

  const otherTasks = db
    .select()
    .from(tasks)
    .where(inArray(tasks.id, otherIds))
    .all();
  const taskById = new Map(otherTasks.map((task) => [task.id, task]));

  const results: TaskRelationWithTask[] = [];
  for (const relation of relations) {
    const otherId =
      relation.fromTaskId === taskId ? relation.toTaskId : relation.fromTaskId;
    const task = taskById.get(otherId);
    if (task) {
      results.push({
        relation,
        task,
        direction: relation.fromTaskId === taskId ? "outgoing" : "incoming",
      });
    }
  }
  return results;
}

export function getBlockersForTask(db: DB, taskId: string): Task[] {
  // Relations where type = "blocks" AND toTaskId = taskId → fromTask is the blocker
  const blockingRelations = db
    .select({
      fromTaskId: taskRelations.fromTaskId,
      toTaskId: taskRelations.toTaskId,
    })
    .from(taskRelations)
    .where(
      and(
        eq(taskRelations.type, "blocks"),
        eq(taskRelations.toTaskId, taskId),
      ),
    )
    .all() as TaskRelationIds[];

  // Relations where type = "depends-on" AND fromTaskId = taskId → toTask is the blocker
  const dependsOnRelations = db
    .select({
      fromTaskId: taskRelations.fromTaskId,
      toTaskId: taskRelations.toTaskId,
    })
    .from(taskRelations)
    .where(
      and(
        eq(taskRelations.type, "depends-on"),
        eq(taskRelations.fromTaskId, taskId),
      ),
    )
    .all() as TaskRelationIds[];

  const blockers: Task[] = [];

  for (const rel of blockingRelations) {
    const blocker = db
      .select()
      .from(tasks)
      .where(eq(tasks.id, rel.fromTaskId))
      .get();
    if (blocker && blocker.status !== "done" && blocker.status !== "cancelled") {
      blockers.push(blocker);
    }
  }

  for (const rel of dependsOnRelations) {
    const blocker = db
      .select()
      .from(tasks)
      .where(eq(tasks.id, rel.toTaskId))
      .get();
    if (blocker && blocker.status !== "done" && blocker.status !== "cancelled") {
      blockers.push(blocker);
    }
  }

  return blockers;
}

export function isTaskBlocked(db: DB, taskId: string): boolean {
  return getBlockersForTask(db, taskId).length > 0;
}

/**
 * Bulk check: returns the set of task IDs (from the given list) that are
 * actively blocked by at least one non-done/non-cancelled blocker.
 */
export function getBlockedTaskIds(db: DB, taskIds: string[]): Set<string> {
  if (taskIds.length === 0) return new Set();

  const blockingRelations: TaskRelationIds[] = [];
  const dependsOnRelations: TaskRelationIds[] = [];

  // Chunk taskIds to avoid exceeding SQLite's IN clause limit
  for (const idChunk of chunkArray(taskIds, SQLITE_IN_CLAUSE_LIMIT)) {
    const chunkBlocking = db
      .select({
        fromTaskId: taskRelations.fromTaskId,
        toTaskId: taskRelations.toTaskId,
      })
      .from(taskRelations)
      .where(
        and(
          eq(taskRelations.type, "blocks"),
          inArray(taskRelations.toTaskId, idChunk),
        ),
      )
      .all() as TaskRelationIds[];
    blockingRelations.push(...chunkBlocking);

    const chunkDependsOn = db
      .select({
        fromTaskId: taskRelations.fromTaskId,
        toTaskId: taskRelations.toTaskId,
      })
      .from(taskRelations)
      .where(
        and(
          eq(taskRelations.type, "depends-on"),
          inArray(taskRelations.fromTaskId, idChunk),
        ),
      )
      .all() as TaskRelationIds[];
    dependsOnRelations.push(...chunkDependsOn);
  }

  // Collect all blocker task IDs we need to check status for
  const blockerIdSet = new Set<string>();
  for (const rel of blockingRelations) blockerIdSet.add(rel.fromTaskId);
  for (const rel of dependsOnRelations) blockerIdSet.add(rel.toTaskId);

  if (blockerIdSet.size === 0) return new Set();

  // Fetch blocker tasks to check their statuses, chunked to avoid IN clause limit
  const blockerTasks: { id: string; status: Task["status"] }[] = [];
  const blockerIds = Array.from(blockerIdSet);
  for (const idChunk of chunkArray(blockerIds, SQLITE_IN_CLAUSE_LIMIT)) {
    const chunkTasks = db
      .select({ id: tasks.id, status: tasks.status })
      .from(tasks)
      .where(inArray(tasks.id, idChunk))
      .all();
    blockerTasks.push(...chunkTasks);
  }

  const activeBlockerIds = new Set(
    blockerTasks
      .filter((t) => t.status !== "done" && t.status !== "cancelled")
      .map((t) => t.id),
  );

  const blocked = new Set<string>();

  for (const rel of blockingRelations) {
    if (activeBlockerIds.has(rel.fromTaskId)) {
      blocked.add(rel.toTaskId);
    }
  }
  for (const rel of dependsOnRelations) {
    if (activeBlockerIds.has(rel.toTaskId)) {
      blocked.add(rel.fromTaskId);
    }
  }

  return blocked;
}

/**
 * Batch-compute which task IDs are blocked and which block others.
 * Scopes the relations query to rows involving the provided taskIds,
 * then fetches blocker completion status in a single follow-up query.
 */
export function getBlockedAndBlockingIds(
  db: DB,
  taskIds: string[],
): { blockedIds: Set<string>; blockingIds: Set<string> } {
  const blockedIds = new Set<string>();
  const blockingIds = new Set<string>();

  if (taskIds.length === 0) return { blockedIds, blockingIds };

  const taskIdSet = new Set(taskIds);

  const relations = db
    .select()
    .from(taskRelations)
    .where(
      and(
        inArray(taskRelations.type, ["blocks", "depends-on"]),
        or(
          inArray(taskRelations.fromTaskId, taskIds),
          inArray(taskRelations.toTaskId, taskIds),
        ),
      ),
    )
    .all();

  // Collect IDs of tasks referenced by blocking relations that we need to
  // check completion status for.
  const blockerCandidateIds = new Set<string>();

  type PendingCheck = { blockedId: string; blockerId: string };
  const pending: PendingCheck[] = [];

  for (const rel of relations) {
    if (rel.type === "blocks") {
      // fromTask blocks toTask
      if (taskIdSet.has(rel.toTaskId)) {
        pending.push({ blockedId: rel.toTaskId, blockerId: rel.fromTaskId });
        blockerCandidateIds.add(rel.fromTaskId);
      }
      if (taskIdSet.has(rel.fromTaskId)) {
        // fromTask is a blocker of something
        blockingIds.add(rel.fromTaskId);
      }
    } else if (rel.type === "depends-on") {
      // fromTask depends on toTask → toTask blocks fromTask
      if (taskIdSet.has(rel.fromTaskId)) {
        pending.push({ blockedId: rel.fromTaskId, blockerId: rel.toTaskId });
        blockerCandidateIds.add(rel.toTaskId);
      }
      if (taskIdSet.has(rel.toTaskId)) {
        blockingIds.add(rel.toTaskId);
      }
    }
  }

  if (pending.length === 0) return { blockedIds, blockingIds };

  // Fetch completion status of blocker candidates
  const candidateIds = Array.from(blockerCandidateIds);
  const blockerTasks: Task[] = db
    .select()
    .from(tasks)
    .where(inArray(tasks.id, candidateIds))
    .all();

  const completedOrCancelled = new Set(
    blockerTasks
      .filter((t: Task) => t.status === "done" || t.status === "cancelled")
      .map((t: Task) => t.id),
  );

  for (const { blockedId, blockerId } of pending) {
    if (!completedOrCancelled.has(blockerId)) {
      blockedIds.add(blockedId);
    }
  }

  return { blockedIds, blockingIds };
}
