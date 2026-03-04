import { describe, it, mock, before, afterEach } from "node:test";
import assert from "node:assert";

// ── Fake data ──────────────────────────────────────────────────────────────

const fakeTask = {
  id: "t1",
  title: "Test task",
  status: "todo",
  description: null,
  assigneeId: null,
  projectId: null,
  priority: "medium",
  source: "human",
  dueDate: null,
  summary: null,
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeTaskWithArtifacts = { ...fakeTask, artifacts: [] };

// ── Mock stubs ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
const createTaskStub = mock.fn<(...a: any[]) => any>(
  (_db: unknown, input: Record<string, unknown>) => ({ ...fakeTask, ...input }),
);
const getTaskStub = mock.fn<(...a: any[]) => any>(
  (_db: unknown, id: string) => (id === "t1" ? fakeTaskWithArtifacts : null),
);
const listTasksStub = mock.fn<(...a: any[]) => any>(() => [fakeTask]);
const updateTaskStub = mock.fn<(...a: any[]) => any>(
  (_db: unknown, id: string, updates: Record<string, unknown>) =>
    id === "t1" ? { ...fakeTask, ...updates } : null,
);
const completeTaskStub = mock.fn<(...a: any[]) => any>(
  (_db: unknown, id: string) =>
    id === "t1" ? { ...fakeTask, status: "done" } : null,
);
const createNotificationStub = mock.fn<(...a: any[]) => any>(() => ({}));
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Mock db ────────────────────────────────────────────────────────────────

const capturedEventInserts: Array<Record<string, unknown>> = [];
const mockEvents = Symbol("events");

const mockDb = {
  insert: (table: unknown) => ({
    values: (val: Record<string, unknown>) => {
      if (table === mockEvents) capturedEventInserts.push(val);
      return { run: () => {} };
    },
  }),
  $client: {
    transaction: <T>(fn: () => T) => () => fn(),
  },
};

// ── Set up module mocks BEFORE dynamic import ──────────────────────────────

mock.module("@clawops/core", {
  namedExports: { db: mockDb, events: mockEvents },
});

mock.module("@clawops/tasks", {
  namedExports: {
    createTask: createTaskStub,
    getTask: getTaskStub,
    listTasks: listTasksStub,
    updateTask: updateTaskStub,
    completeTask: completeTaskStub,
  },
});

mock.module("@clawops/notifications", {
  namedExports: { createNotification: createNotificationStub },
});

// ── Dynamic import AFTER mocks ─────────────────────────────────────────────

const { taskRoutes } = await import("./tasks.js");
const { default: Fastify } = await import("fastify");

// ── Tests ──────────────────────────────────────────────────────────────────

describe("taskRoutes", () => {
  let app: ReturnType<typeof Fastify>;

  before(async () => {
    app = Fastify();
    await app.register(taskRoutes);
    await app.ready();
  });

  afterEach(() => {
    capturedEventInserts.length = 0;
    createTaskStub.mock.resetCalls();
    getTaskStub.mock.resetCalls();
    listTasksStub.mock.resetCalls();
    updateTaskStub.mock.resetCalls();
    completeTaskStub.mock.resetCalls();
    createNotificationStub.mock.resetCalls();
  });

  // ── POST /tasks ─────────────────────────────────────────────────────────

  describe("POST /tasks", () => {
    it("creates a task inside a transaction and returns 201", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/tasks",
        body: { title: "Do stuff" },
      });

      assert.strictEqual(res.statusCode, 201);
      const body = res.json();
      assert.strictEqual(body.title, "Do stuff");
      assert.strictEqual(createTaskStub.mock.callCount(), 1);
      assert.strictEqual(capturedEventInserts.length, 1);
      assert.strictEqual(capturedEventInserts[0].action, "task.created");
    });
  });

  // ── GET /tasks ──────────────────────────────────────────────────────────

  describe("GET /tasks", () => {
    it("returns a list of tasks", async () => {
      const res = await app.inject({ method: "GET", url: "/tasks" });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.ok(Array.isArray(body));
      assert.strictEqual(body.length, 1);
    });

    it("passes query-string filters through", async () => {
      await app.inject({ method: "GET", url: "/tasks?status=todo" });

      const call = listTasksStub.mock.calls[0];
      assert.strictEqual(call.arguments[1].status, "todo");
    });
  });

  // ── GET /tasks/:id ─────────────────────────────────────────────────────

  describe("GET /tasks/:id", () => {
    it("returns the task when it exists", async () => {
      const res = await app.inject({ method: "GET", url: "/tasks/t1" });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.id, "t1");
    });

    it("returns 404 when the task does not exist", async () => {
      const res = await app.inject({ method: "GET", url: "/tasks/nope" });

      assert.strictEqual(res.statusCode, 404);
      const body = res.json();
      assert.strictEqual(body.code, "TASK_NOT_FOUND");
    });
  });

  // ── PATCH /tasks/:id ───────────────────────────────────────────────────

  describe("PATCH /tasks/:id", () => {
    it("updates a task inside a transaction", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/tasks/t1",
        body: { title: "New" },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(updateTaskStub.mock.callCount(), 1);
      assert.strictEqual(capturedEventInserts.length, 1);
      assert.strictEqual(capturedEventInserts[0].action, "task.updated");
    });

    it("returns 404 when the task does not exist", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/tasks/missing",
        body: { title: "X" },
      });

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(capturedEventInserts.length, 0);
    });

    it("records updated fields in the audit event meta", async () => {
      await app.inject({
        method: "PATCH",
        url: "/tasks/t1",
        body: { title: "New", description: "Desc" },
      });

      assert.strictEqual(capturedEventInserts.length, 1);
      const meta = JSON.parse(capturedEventInserts[0].meta as string);
      assert.deepStrictEqual(meta.fields.sort(), ["description", "title"]);
    });
  });

  // ── POST /tasks/:id/complete ───────────────────────────────────────────

  describe("POST /tasks/:id/complete", () => {
    it("completes the task, creates a notification, and emits events", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/tasks/t1/complete",
        body: { summary: "All done" },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(completeTaskStub.mock.callCount(), 1);
      assert.strictEqual(createNotificationStub.mock.callCount(), 1);
      assert.strictEqual(capturedEventInserts.length, 1);
      assert.strictEqual(capturedEventInserts[0].action, "task.completed");
    });

    it("returns 404 when the task does not exist", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/tasks/missing/complete",
        body: { summary: "nope" },
      });

      assert.strictEqual(res.statusCode, 404);
    });
  });
});
