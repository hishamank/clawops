import { describe, it, mock } from "node:test";
import assert from "node:assert";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Fake data ────────────────────────────────────────────────────────────────

const FAKE_TASK = {
  id: "task-1",
  title: "Test Task",
  description: null,
  status: "todo",
  priority: "medium",
  assigneeId: null,
  projectId: null,
  source: "human",
  dueDate: null,
  completedAt: null,
  summary: null,
  createdAt: new Date().toISOString(),
};

function makeChain(row: any = FAKE_TASK, rows: any[] = [FAKE_TASK]): any {
  const c: any = {
    all: () => rows,
    get: () => row,
    returning: () => c,
    where: () => c,
    from: () => c,
    values: () => c,
    set: () => c,
    orderBy: () => c,
    limit: () => c,
  };
  return c;
}

function makeDb(row?: any, rows?: any[]): any {
  const c = makeChain(row, rows);
  return { insert: () => c, select: () => c, update: () => c, delete: () => c };
}

// ── Mock @clawops/core so tsx never needs to load its TS source ──────────────

mock.module("@clawops/core", {
  namedExports: {
    db: makeDb(),
    tasks: Symbol("tasks"),
    artifacts: Symbol("artifacts"),
    usageLogs: Symbol("usageLogs"),
    eq: () => ({}),
    and: () => ({}),
  },
});

mock.module("@clawops/domain", {
  namedExports: {
    calcCost: () => 0.001,
    MODEL_PRICING: {},
    NotFoundError: class NotFoundError extends Error {},
    ConflictError: class ConflictError extends Error {},
  },
});

mock.module("drizzle-orm", {
  namedExports: {
    eq: () => ({}),
    and: () => ({}),
    or: () => ({}),
  },
});

const { createTask, getTask, listTasks, updateTask } = await import("../dist/index.js");

// ── Tests ────────────────────────────────────────────────────────────────────

describe("createTask", () => {
  it("returns a task row", () => {
    const result = createTask(makeDb(), { title: "My Task" });
    assert.ok(result);
    assert.equal(result.id, "task-1");
  });

  it("passes title through to DB values", () => {
    let capturedValues: any;
    const chain: any = {
      all: () => [FAKE_TASK], get: () => FAKE_TASK, returning: () => chain,
      where: () => chain, from: () => chain,
      values: (v: any) => { capturedValues = v; return chain; },
    };
    const db = { insert: () => chain, select: () => chain, update: () => chain };
    createTask(db as any, { title: "Custom Title" });
    assert.equal(capturedValues?.title, "Custom Title");
  });
});

describe("getTask", () => {
  it("returns task with artifacts array when found", () => {
    const result = getTask(makeDb(), "task-1");
    assert.ok(result);
    assert.ok(Array.isArray((result as any).artifacts));
  });

  it("returns null when task not found", () => {
    const nullChain: any = {
      all: () => [], get: () => null, returning: () => nullChain,
      where: () => nullChain, from: () => nullChain, values: () => nullChain,
    };
    const db = { insert: () => nullChain, select: () => nullChain, update: () => nullChain };
    const result = getTask(db as any, "nonexistent");
    assert.equal(result, null);
  });
});

describe("listTasks", () => {
  it("returns an array", () => {
    const result = listTasks(makeDb(), {});
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 1);
  });
});

describe("updateTask", () => {
  it("returns updated task", () => {
    const result = updateTask(makeDb(), "task-1", { status: "done" });
    assert.ok(result);
  });
});
