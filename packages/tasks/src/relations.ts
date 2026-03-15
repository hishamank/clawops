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
    .select()
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
    .select()
    .from(taskRelations)
    .where(
      and(
        eq(taskRelations.type, "blocks"),
        eq(taskRelations.toTaskId, taskId),
      ),
    )
    .all();

  // Relations where type = "depends-on" AND fromTaskId = taskId → toTask is the blocker
  const dependsOnRelations = db
    .select()
    .from(taskRelations)
    .where(
      and(
        eq(taskRelations.type, "depends-on"),
        eq(taskRelations.fromTaskId, taskId),
      ),
    )
    .all();

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
 * Batch-compute which task IDs are blocked and which block others,
 * using only two queries instead of one per task.
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
    .where(inArray(taskRelations.type, ["blocks", "depends-on"]))
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
