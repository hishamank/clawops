import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert";

// ── Stubs ───────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
const insertRun = mock.fn<(...a: any[]) => any>();
const insertValues = mock.fn<(...a: any[]) => any>(() => ({ run: insertRun }));
const insertFn = mock.fn<(...a: any[]) => any>(() => ({ values: insertValues }));
const transactionFn = mock.fn<(...a: any[]) => any>((fn: () => unknown) => fn);

const fakeDb = {
  $client: { transaction: () => transactionFn },
  insert: insertFn,
};
const fakeEvents = Symbol("events");

const createTaskMock = mock.fn<(...a: any[]) => any>();
const getTaskMock = mock.fn<(...a: any[]) => any>();
const listTasksMock = mock.fn<(...a: any[]) => any>();
const updateTaskMock = mock.fn<(...a: any[]) => any>();
const completeTaskMock = mock.fn<(...a: any[]) => any>();
const createNotificationMock = mock.fn<(...a: any[]) => any>();
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Module mocks (must precede dynamic import) ─────────────────────────────

mock.module("@clawops/core", {
  namedExports: { db: fakeDb, events: fakeEvents },
});

mock.module("@clawops/tasks", {
  namedExports: {
    createTask: createTaskMock,
    getTask: getTaskMock,
    listTasks: listTasksMock,
    updateTask: updateTaskMock,
    completeTask: completeTaskMock,
  },
});

mock.module("@clawops/notifications", {
  namedExports: { createNotification: createNotificationMock },
});

// Domain enums are plain objects – pass them through unchanged.
const { TaskStatus } = await import("@clawops/domain");

// Now import the code under test + Fastify.
const { taskRoutes } = await import("./tasks.js");
const Fastify = (await import("fastify")).default;

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildApp() {
  const app = Fastify();
  app.register(taskRoutes);
  return app;
}

function resetMocks() {
  createTaskMock.mock.resetCalls();
  getTaskMock.mock.resetCalls();
  listTasksMock.mock.resetCalls();
  updateTaskMock.mock.resetCalls();
  completeTaskMock.mock.resetCalls();
  createNotificationMock.mock.resetCalls();
  insertFn.mock.resetCalls();
  insertValues.mock.resetCalls();
  insertRun.mock.resetCalls();
  transactionFn.mock.resetCalls();
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("POST /tasks", () => {
  beforeEach(resetMocks);

  it("creates a task inside a transaction and returns 201", async () => {
    const task = { id: "t1", title: "Do stuff" };
    createTaskMock.mock.mockImplementation(() => task);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/tasks",
      payload: { title: "Do stuff" },
    });

    assert.strictEqual(res.statusCode, 201);
    assert.deepStrictEqual(JSON.parse(res.body), task);
    assert.strictEqual(transactionFn.mock.callCount(), 1, "mutation wrapped in transaction");
    assert.strictEqual(insertFn.mock.callCount(), 1, "writeEvent called");
  });
});

describe("GET /tasks", () => {
  beforeEach(resetMocks);

  it("returns a list of tasks", async () => {
    const tasks = [{ id: "t1" }, { id: "t2" }];
    listTasksMock.mock.mockImplementation(() => tasks);

    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/tasks" });

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(res.body), tasks);
  });

  it("passes query-string filters through", async () => {
    listTasksMock.mock.mockImplementation(() => []);

    const app = buildApp();
    await app.inject({ method: "GET", url: `/tasks?status=${TaskStatus.todo}` });

    const call = listTasksMock.mock.calls[0];
    assert.strictEqual(call.arguments[1].status, TaskStatus.todo);
  });
});

describe("GET /tasks/:id", () => {
  beforeEach(resetMocks);

  it("returns the task when it exists", async () => {
    const task = { id: "t1", title: "X", artifacts: [] };
    getTaskMock.mock.mockImplementation(() => task);

    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/tasks/t1" });

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(res.body), task);
  });

  it("returns 404 when the task does not exist", async () => {
    getTaskMock.mock.mockImplementation(() => null);

    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/tasks/nope" });

    assert.strictEqual(res.statusCode, 404);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.code, "TASK_NOT_FOUND");
  });
});

describe("PATCH /tasks/:id", () => {
  beforeEach(resetMocks);

  it("updates a task inside a transaction", async () => {
    const updated = { id: "t1", title: "New" };
    updateTaskMock.mock.mockImplementation(() => updated);

    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/tasks/t1",
      payload: { title: "New" },
    });

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(res.body), updated);
    assert.strictEqual(transactionFn.mock.callCount(), 1);
  });

  it("returns 404 when the task does not exist", async () => {
    updateTaskMock.mock.mockImplementation(() => null);

    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/tasks/missing",
      payload: { title: "X" },
    });

    assert.strictEqual(res.statusCode, 404);
  });
});

describe("POST /tasks/:id/complete", () => {
  beforeEach(resetMocks);

  it("completes the task, creates a notification, and emits events", async () => {
    const task = { id: "t1", title: "Done" };
    completeTaskMock.mock.mockImplementation(() => task);
    createNotificationMock.mock.mockImplementation(() => ({}));

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/tasks/t1/complete",
      payload: { summary: "All done" },
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(transactionFn.mock.callCount(), 1, "wrapped in transaction");
    assert.strictEqual(createNotificationMock.mock.callCount(), 1, "notification created");
    assert.ok(insertFn.mock.callCount() >= 1, "at least one event written");
  });

  it("returns 404 when the task does not exist", async () => {
    completeTaskMock.mock.mockImplementation(() => null);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/tasks/missing/complete",
      payload: { summary: "nope" },
    });

    assert.strictEqual(res.statusCode, 404);
  });
});
