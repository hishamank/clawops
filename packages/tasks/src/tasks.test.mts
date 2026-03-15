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
    taskRelations: Symbol("taskRelations"),
    resourceLinks: Symbol("resourceLinks"),
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
    inArray: () => ({}),
  },
});

const { createTask, getTask, listTasks, updateTask, parseTaskProperties, getBlockedAndBlockingIds } = await import("../dist/index.js");

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

describe("parseTaskProperties", () => {
  it("returns {} for null properties", () => {
    const result = parseTaskProperties({ ...FAKE_TASK, properties: null });
    assert.deepStrictEqual(result, {});
  });

  it("returns {} for invalid JSON", () => {
    const result = parseTaskProperties({ ...FAKE_TASK, properties: "not json" });
    assert.deepStrictEqual(result, {});
  });

  it("parses valid JSON properties", () => {
    const result = parseTaskProperties({
      ...FAKE_TASK,
      properties: JSON.stringify({ key: "value", num: 42 }),
    });
    assert.deepStrictEqual(result, { key: "value", num: 42 });
  });

  it("returns {} for JSON array", () => {
    const result = parseTaskProperties({
      ...FAKE_TASK,
      properties: JSON.stringify([1, 2, 3]),
    });
    assert.deepStrictEqual(result, {});
  });
});

describe("getBlockedAndBlockingIds", () => {
  it("returns empty sets for empty task list", () => {
    const result = getBlockedAndBlockingIds(makeDb(null, []), []);
    assert.equal(result.blockedIds.size, 0);
    assert.equal(result.blockingIds.size, 0);
  });

  it("returns empty sets when no blocking relations exist", () => {
    // DB returns no relations from taskRelations query
    const db = makeDb(null, []);
    const result = getBlockedAndBlockingIds(db, ["task-1", "task-2"]);
    assert.equal(result.blockedIds.size, 0);
    assert.equal(result.blockingIds.size, 0);
  });

  it("identifies blocked and blocking tasks from blocks relations", () => {
    const relations = [
      { type: "blocks", fromTaskId: "task-a", toTaskId: "task-b" },
    ];
    const blockerTask = { ...FAKE_TASK, id: "task-a", status: "todo" };

    let selectCallCount = 0;
    const selectChain: any = {
      all: () => {
        selectCallCount++;
        // First call returns relations, second returns blocker tasks
        return selectCallCount === 1 ? relations : [blockerTask];
      },
      get: () => null,
      where: () => selectChain,
      from: () => selectChain,
    };
    const db: any = {
      insert: () => selectChain,
      select: () => selectChain,
      update: () => selectChain,
      delete: () => selectChain,
    };

    const result = getBlockedAndBlockingIds(db, ["task-a", "task-b"]);
    assert.ok(result.blockedIds.has("task-b"));
    assert.ok(result.blockingIds.has("task-a"));
  });

  it("does not mark task as blocked when blocker is done", () => {
    const relations = [
      { type: "blocks", fromTaskId: "task-a", toTaskId: "task-b" },
    ];
    const doneBlocker = { ...FAKE_TASK, id: "task-a", status: "done" };

    let selectCallCount = 0;
    const selectChain: any = {
      all: () => {
        selectCallCount++;
        return selectCallCount === 1 ? relations : [doneBlocker];
      },
      get: () => null,
      where: () => selectChain,
      from: () => selectChain,
    };
    const db: any = {
      insert: () => selectChain,
      select: () => selectChain,
      update: () => selectChain,
      delete: () => selectChain,
    };

    const result = getBlockedAndBlockingIds(db, ["task-a", "task-b"]);
    assert.equal(result.blockedIds.has("task-b"), false);
  });
});
