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
