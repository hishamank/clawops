import { describe, it, before } from "node:test";
import assert from "node:assert";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DB } from "@clawops/core";
import * as schema from "@clawops/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  createTask,
  getTask,
  listTasks,
  getPullableTasks,
  updateTask,
  completeTask,
  parseTaskProperties,
  addTaskResourceLink,
  listTaskResourceLinks,
  removeTaskResourceLink,
  createTaskRelation,
  listTaskRelations,
  deleteTaskRelation,
  getBlockersForTask,
  isTaskBlocked,
  getBlockedTaskIds,
  deleteTask,
} = await import("@clawops/tasks");

let db: DB;

before(() => {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema }) as DB;
  migrate(db, {
    migrationsFolder: path.resolve(__dirname, "../../core/migrations"),
  });
});

describe("task resource links", () => {
  it("adds, lists, and removes a resource link", () => {
    const task = createTask(db, { title: "Link task" });
    const link = addTaskResourceLink(db, task.id, {
      provider: "github",
      resourceType: "issue",
      url: "https://github.com/hishamank/clawops/issues/123",
      externalId: "123",
      meta: { context: "issue" },
      label: "Issue link",
    });

    const links = listTaskResourceLinks(db, task.id);
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].id, link.id);
    assert.strictEqual(links[0].provider, "github");
    assert.strictEqual(JSON.parse(links[0].meta ?? "{}").context, "issue");

    const removed = removeTaskResourceLink(db, task.id, link.id);
    assert.strictEqual(removed?.id, link.id);
    assert.strictEqual(listTaskResourceLinks(db, task.id).length, 0);
  });

  it("refuses to remove a link for another task", () => {
    const primary = createTask(db, { title: "Primary task" });
    const other = createTask(db, { title: "Other task" });
    const link = addTaskResourceLink(db, primary.id, {
      provider: "github",
      resourceType: "issue",
      url: "https://example.com/resource",
    });

    const removed = removeTaskResourceLink(db, other.id, link.id);
    assert.strictEqual(removed, null);
    const remaining = listTaskResourceLinks(db, primary.id);
    assert.strictEqual(remaining.length, 1);
  });
});
describe("task relations", () => {
  it("creates relations and reports direction and delete behavior", () => {
    const parent = createTask(db, { title: "Parent task" });
    const child = createTask(db, { title: "Child task" });
    const relation = createTaskRelation(db, {
      fromTaskId: parent.id,
      toTaskId: child.id,
      type: "blocks",
    });

    const childRelations = listTaskRelations(db, child.id);
    assert.strictEqual(childRelations.length, 1);
    assert.strictEqual(childRelations[0].relation.id, relation.id);
    assert.strictEqual(childRelations[0].direction, "incoming");

    const parentRelations = listTaskRelations(db, parent.id);
    assert.strictEqual(parentRelations.length, 1);
    assert.strictEqual(parentRelations[0].direction, "outgoing");

    deleteTaskRelation(db, relation.id);
    assert.strictEqual(listTaskRelations(db, child.id).length, 0);
  });

  it("includes only active blockers", () => {
    const blocker = createTask(db, { title: "Blocking task" });
    const doneBlocker = createTask(db, { title: "Done blocker" });
    const blocked = createTask(db, { title: "Blocked task" });

    const blockingRelation = createTaskRelation(db, {
      fromTaskId: blocker.id,
      toTaskId: blocked.id,
      type: "blocks",
    });
    const doneRelation = createTaskRelation(db, {
      fromTaskId: doneBlocker.id,
      toTaskId: blocked.id,
      type: "blocks",
    });

    updateTask(db, doneBlocker.id, { status: "done" });

    const blockers = getBlockersForTask(db, blocked.id);
    assert.strictEqual(blockers.length, 1);
    assert.strictEqual(blockers[0].id, blocker.id);
    assert.strictEqual(isTaskBlocked(db, blocked.id), true);

    deleteTaskRelation(db, blockingRelation.id);
    deleteTaskRelation(db, doneRelation.id);
    assert.strictEqual(isTaskBlocked(db, blocked.id), false);
  });
});
describe("tasks (integration)", () => {
  it("createTask inserts a row and returns it", () => {
    const task = createTask(db, { title: "Integration task" });

    assert.ok(task.id);
    assert.strictEqual(task.title, "Integration task");
    assert.strictEqual(task.status, "backlog");
    assert.strictEqual(task.priority, "medium");
    assert.ok(task.createdAt);
  });

  it("getTask returns the task with artifacts", () => {
    const created = createTask(db, { title: "Fetch me" });
    const fetched = getTask(db, created.id);

    assert.ok(fetched);
    assert.strictEqual(fetched.id, created.id);
    assert.strictEqual(fetched.title, "Fetch me");
    assert.deepStrictEqual(fetched.artifacts, []);
  });

  it("getTask returns null for nonexistent ID", () => {
    const result = getTask(db, "nonexistent-id");
    assert.strictEqual(result, null);
  });

  it("listTasks returns all tasks", () => {
    const all = listTasks(db);
    assert.ok(all.length >= 2);
  });

  it("listTasks filters by status", () => {
    createTask(db, { title: "Todo task", status: "todo" });
    const todos = listTasks(db, { status: "todo" });

    assert.ok(todos.length >= 1);
    assert.ok(todos.every((t: { status: string }) => t.status === "todo"));
  });

  it("updateTask modifies fields", () => {
    const task = createTask(db, { title: "Old title" });
    const updated = updateTask(db, task.id, { title: "New title", priority: "high" });

    assert.strictEqual(updated.title, "New title");
    assert.strictEqual(updated.priority, "high");
  });

  it("completeTask sets status to done and records summary", () => {
    const task = createTask(db, { title: "To complete" });
    const completed = completeTask(db, task.id, { summary: "All done" });

    assert.strictEqual(completed.status, "done");
    assert.strictEqual(completed.summary, "All done");
    assert.ok(completed.completedAt);
  });

  it("completeTask stores artifacts", () => {
    const task = createTask(db, { title: "With artifacts" });
    completeTask(db, task.id, {
      summary: "Done with artifacts",
      artifacts: [{ label: "PR", value: "https://github.com/pr/1" }],
    });

    const fetched = getTask(db, task.id);
    assert.ok(fetched);
    assert.strictEqual(fetched.artifacts.length, 1);
    assert.strictEqual(fetched.artifacts[0].label, "PR");
  });

  it("createTask with templateId, stageId, properties, and ideaId", () => {
    const task = createTask(db, {
      title: "Templated task",
      properties: { priority_score: 95, tags: ["urgent"] },
    });

    assert.ok(task.id);
    assert.strictEqual(task.title, "Templated task");
    const props = parseTaskProperties(task);
    assert.strictEqual(props.priority_score, 95);
    assert.deepStrictEqual(props.tags, ["urgent"]);
  });

  it("updateTask sets and clears properties", () => {
    const task = createTask(db, {
      title: "Props task",
      properties: { foo: "bar" },
    });

    const props1 = parseTaskProperties(task);
    assert.strictEqual(props1.foo, "bar");

    const updated = updateTask(db, task.id, { properties: { baz: 123 } });
    const props2 = parseTaskProperties(updated);
    assert.strictEqual(props2.baz, 123);
    assert.strictEqual(props2.foo, undefined);

    const cleared = updateTask(db, task.id, { properties: null });
    const props3 = parseTaskProperties(cleared);
    assert.deepStrictEqual(props3, {});
  });

  it("parseTaskProperties returns {} for null and invalid JSON", () => {
    const task = createTask(db, { title: "No props" });
    assert.deepStrictEqual(parseTaskProperties(task), {});

    const fakeTask = { ...task, properties: "invalid{json" };
    assert.deepStrictEqual(parseTaskProperties(fakeTask), {});
  });
});

describe("getPullableTasks", () => {
  it("returns tasks with pullable statuses", () => {
    const backlog = createTask(db, { title: "Backlog task", status: "backlog" });
    const todo = createTask(db, { title: "Todo task", status: "todo" });
    const inProgress = createTask(db, { title: "In progress task", status: "in-progress" });
    const review = createTask(db, { title: "Review task", status: "review" });

    const pullable = getPullableTasks(db);
    const ids = pullable.map((t) => t.id);

    assert.ok(ids.includes(backlog.id), "should include backlog tasks");
    assert.ok(ids.includes(todo.id), "should include todo tasks");
    assert.ok(ids.includes(inProgress.id), "should include in-progress tasks");
    assert.ok(ids.includes(review.id), "should include review tasks");
  });

  it("excludes done and cancelled tasks", () => {
    const done = createTask(db, { title: "Done task", status: "done" });
    const cancelled = createTask(db, { title: "Cancelled task", status: "cancelled" });

    const pullable = getPullableTasks(db);
    const ids = pullable.map((t) => t.id);

    assert.ok(!ids.includes(done.id), "should exclude done tasks");
    assert.ok(!ids.includes(cancelled.id), "should exclude cancelled tasks");
  });

  it("excludes assigned tasks", () => {
    const unassigned = createTask(db, { title: "Unassigned task", status: "todo" });
    const assigned = createTask(db, { title: "Assigned task", status: "todo", assigneeId: "agent-1" });

    const pullable = getPullableTasks(db);
    const ids = pullable.map((t) => t.id);

    assert.ok(ids.includes(unassigned.id), "should include unassigned tasks");
    assert.ok(!ids.includes(assigned.id), "should exclude assigned tasks");
  });

  it("excludes blocked tasks", () => {
    const blocker = createTask(db, { title: "Blocker", status: "todo" });
    const blocked = createTask(db, { title: "Blocked task", status: "todo" });
    const unblocked = createTask(db, { title: "Unblocked task", status: "todo" });

    createTaskRelation(db, {
      fromTaskId: blocker.id,
      toTaskId: blocked.id,
      type: "blocks",
    });

    const pullable = getPullableTasks(db);
    const ids = pullable.map((t) => t.id);

    assert.ok(!ids.includes(blocked.id), "should exclude blocked tasks");
    assert.ok(ids.includes(unblocked.id), "should include unblocked tasks");
  });

  it("excludes tasks with autoPullEligible=false", () => {
    const eligible = createTask(db, { title: "Eligible task", status: "todo" });
    const ineligible = createTask(db, { title: "Ineligible task", status: "todo" });
    updateTask(db, ineligible.id, { autoPullEligible: false });

    const pullable = getPullableTasks(db);
    const ids = pullable.map((t) => t.id);

    assert.ok(ids.includes(eligible.id), "should include eligible tasks");
    assert.ok(!ids.includes(ineligible.id), "should exclude ineligible tasks");
  });

  it("filters by projectId", () => {
    const project1 = createTask(db, { title: "Project 1 task", status: "todo", projectId: "proj-1" });
    const project2 = createTask(db, { title: "Project 2 task", status: "todo", projectId: "proj-2" });

    const pullable = getPullableTasks(db, { projectId: "proj-1" });
    const ids = pullable.map((t) => t.id);

    assert.ok(ids.includes(project1.id), "should include tasks in project");
    assert.ok(!ids.includes(project2.id), "should exclude tasks not in project");
  });

  it("filters by priority", () => {
    const high = createTask(db, { title: "High priority", status: "todo", priority: "high" });
    const low = createTask(db, { title: "Low priority", status: "todo", priority: "low" });

    const pullable = getPullableTasks(db, { priority: "high" });
    const ids = pullable.map((t) => t.id);

    assert.ok(ids.includes(high.id), "should include high priority tasks");
    assert.ok(!ids.includes(low.id), "should exclude low priority tasks");
  });

  it("returns tasks sorted by createdAt", () => {
    const first = createTask(db, { title: "First task", status: "todo" });
    const second = createTask(db, { title: "Second task", status: "todo" });
    const third = createTask(db, { title: "Third task", status: "todo" });

    const pullable = getPullableTasks(db);
    const ids = pullable.map((t) => t.id);

    const firstIdx = ids.indexOf(first.id);
    const secondIdx = ids.indexOf(second.id);
    const thirdIdx = ids.indexOf(third.id);

    assert.ok(firstIdx < secondIdx, "first task should come before second");
    assert.ok(secondIdx < thirdIdx, "second task should come before third");
  });

  it("includes tasks whose blocker is done", () => {
    const blocker = createTask(db, { title: "Blocker (done)", status: "todo" });
    const blocked = createTask(db, { title: "Was blocked", status: "todo" });

    const rel = createTaskRelation(db, {
      fromTaskId: blocker.id,
      toTaskId: blocked.id,
      type: "blocks",
    });

    // While blocker is active, blocked task should not be pullable
    let pullable = getPullableTasks(db);
    assert.ok(!pullable.map((t) => t.id).includes(blocked.id), "should exclude actively blocked task");

    // Complete the blocker → blocked task should now be pullable
    updateTask(db, blocker.id, { status: "done" });
    pullable = getPullableTasks(db);
    assert.ok(pullable.map((t) => t.id).includes(blocked.id), "should include task whose blocker is done");

    deleteTaskRelation(db, rel.id);
  });
});

describe("listTasks filter fields", () => {
  it("filters by ideaId", () => {
    const withIdea = createTask(db, { title: "Idea task", ideaId: "idea-filter-1" });
    const without = createTask(db, { title: "No idea task" });

    const results = listTasks(db, { ideaId: "idea-filter-1" });
    const ids = results.map((t) => t.id);

    assert.ok(ids.includes(withIdea.id), "should include task with matching ideaId");
    assert.ok(!ids.includes(without.id), "should exclude task without matching ideaId");
  });

  it("filters by templateId", () => {
    const withTemplate = createTask(db, { title: "Template task", templateId: "tmpl-filter-1" });
    const without = createTask(db, { title: "No template task" });

    const results = listTasks(db, { templateId: "tmpl-filter-1" });
    const ids = results.map((t) => t.id);

    assert.ok(ids.includes(withTemplate.id), "should include task with matching templateId");
    assert.ok(!ids.includes(without.id), "should exclude task without matching templateId");
  });

  it("filters by stageId", () => {
    const withStage = createTask(db, { title: "Stage task", stageId: "stage-filter-1" });
    const without = createTask(db, { title: "No stage task" });

    const results = listTasks(db, { stageId: "stage-filter-1" });
    const ids = results.map((t) => t.id);

    assert.ok(ids.includes(withStage.id), "should include task with matching stageId");
    assert.ok(!ids.includes(without.id), "should exclude task without matching stageId");
  });
});

describe("getBlockedTaskIds", () => {
  it("returns blocked task IDs for active blockers only", () => {
    const blocker = createTask(db, { title: "Active blocker", status: "todo" });
    const doneBlocker = createTask(db, { title: "Done blocker", status: "todo" });
    const blocked1 = createTask(db, { title: "Blocked by active" });
    const blocked2 = createTask(db, { title: "Blocked by done" });

    const rel1 = createTaskRelation(db, {
      fromTaskId: blocker.id,
      toTaskId: blocked1.id,
      type: "blocks",
    });
    const rel2 = createTaskRelation(db, {
      fromTaskId: doneBlocker.id,
      toTaskId: blocked2.id,
      type: "blocks",
    });

    updateTask(db, doneBlocker.id, { status: "done" });

    const result = getBlockedTaskIds(db, [blocked1.id, blocked2.id]);
    assert.ok(result.has(blocked1.id), "should include task blocked by active blocker");
    assert.ok(!result.has(blocked2.id), "should exclude task blocked by done blocker");

    deleteTaskRelation(db, rel1.id);
    deleteTaskRelation(db, rel2.id);
  });

  it("returns empty set for empty input", () => {
    const result = getBlockedTaskIds(db, []);
    assert.strictEqual(result.size, 0);
  });
});

describe("deleteTask", () => {
  it("deletes a task and returns the deleted row", () => {
    const task = createTask(db, { title: "To be deleted" });
    const deleted = deleteTask(db, task.id);

    assert.ok(deleted);
    assert.strictEqual(deleted.id, task.id);
    assert.strictEqual(getTask(db, task.id), null);
  });

  it("returns null for nonexistent task ID", () => {
    const result = deleteTask(db, "nonexistent-id");
    assert.strictEqual(result, null);
  });

  it("cascades deletion to artifacts", () => {
    const task = createTask(db, { title: "Task with artifacts" });
    completeTask(db, task.id, {
      summary: "Done",
      artifacts: [{ label: "PR", value: "https://github.com/pr/1" }],
    });

    const fetched = getTask(db, task.id);
    assert.ok(fetched);
    assert.strictEqual(fetched.artifacts.length, 1);

    deleteTask(db, task.id);

    const reFetched = getTask(db, task.id);
    assert.strictEqual(reFetched, null);

    const remainingArtifacts = db.select().from(schema.artifacts).all();
    assert.strictEqual(
      remainingArtifacts.filter((a) => a.taskId === task.id).length,
      0,
      "No artifacts should remain for the deleted task",
    );
  });

  it("cascades deletion to task relations", () => {
    const parent = createTask(db, { title: "Parent" });
    const child = createTask(db, { title: "Child" });
    const relation = createTaskRelation(db, {
      fromTaskId: parent.id,
      toTaskId: child.id,
      type: "blocks",
    });

    assert.strictEqual(listTaskRelations(db, parent.id).length, 1);

    deleteTask(db, parent.id);

    assert.strictEqual(listTaskRelations(db, child.id).length, 0);

    deleteTaskRelation(db, relation.id);
  });

  it("can delete a task after marking it done", () => {
    const task = createTask(db, { title: "Done then deleted" });
    const done = completeTask(db, task.id, { summary: "Done" });
    assert.strictEqual(done.status, "done");

    const deleted = deleteTask(db, task.id);
    assert.ok(deleted);
    assert.strictEqual(getTask(db, task.id), null);
  });
});
