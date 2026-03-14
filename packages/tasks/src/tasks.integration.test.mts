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

const { createTask, getTask, listTasks, updateTask, completeTask, parseTaskProperties } = await import(
  "@clawops/tasks"
);

let db: DB;

before(() => {
  const sqlite = new Database(":memory:");
  db = drizzle(sqlite, { schema }) as DB;
  migrate(db, {
    migrationsFolder: path.resolve(__dirname, "../../core/migrations"),
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
      templateId: null as unknown as string,
      stageId: null as unknown as string,
      properties: { priority_score: 95, tags: ["urgent"] },
      ideaId: null as unknown as string,
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
