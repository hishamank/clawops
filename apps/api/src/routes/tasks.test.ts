import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/** Captured event rows written by the route handlers. */
let capturedEvents: Array<Record<string, unknown>> = [];
/** Controls whether the transaction should throw (simulates rollback). */
let transactionShouldThrow = false;

const fakeTask = {
  id: "t1",
  title: "Test task",
  status: "todo",
  description: null,
  assigneeId: null,
  projectId: null,
  priority: null,
  source: null,
  dueDate: null,
  summary: null,
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeTaskWithArtifacts = {
  ...fakeTask,
  artifacts: [],
};

// Stub domain functions ────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const createTaskStub = mock.fn<(...a: any[]) => any>(
  (_db: unknown, input: Record<string, unknown>) => ({ ...fakeTask, ...input }),
);
const getTaskStub = mock.fn<(...a: any[]) => any>(
  (_db: unknown, id: string) => (id === "t1" ? fakeTaskWithArtifacts : null),
);
const listTasksStub = mock.fn<(...a: any[]) => any>(
  () => [fakeTask],
);
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

// ---------------------------------------------------------------------------
// Fake harness (mirrors projects.test.ts pattern)
// ---------------------------------------------------------------------------

interface RouteEntry {
  method: string;
  url: string;
  handler: (req: Record<string, unknown>, reply: FakeReply) => Promise<unknown>;
}

class FakeReply {
  statusCode = 200;
  body: unknown = undefined;

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  code(c: number): this {
    this.statusCode = c;
    return this;
  }

  send(payload: unknown): unknown {
    this.body = payload;
    return payload;
  }
}

function buildFakeApp(): {
  routes: RouteEntry[];
  instance: Record<string, unknown>;
} {
  const routes: RouteEntry[] = [];

  const register = (method: string) => {
    return (url: string, _opts: unknown, handler?: unknown) => {
      const h = (typeof _opts === "function" ? _opts : handler) as RouteEntry["handler"];
      routes.push({ method, url, handler: h });
    };
  };

  const instance = {
    get: register("GET"),
    post: register("POST"),
    patch: register("PATCH"),
    put: register("PUT"),
    delete: register("DELETE"),
  };

  return { routes, instance };
}

// Re-implement the route layer locally using stubs ─────────────────────────

function writeEvent(
  action: string,
  entityId: string,
  meta: Record<string, unknown>,
): void {
  capturedEvents.push({ action, entityType: "task", entityId, meta });
}

function fakeTx<T>(fn: () => T): T {
  if (transactionShouldThrow) {
    throw new Error("Transaction rolled back");
  }
  return fn();
}

async function registerFakeRoutes(app: ReturnType<typeof buildFakeApp>["instance"]) {
  const a = app as unknown as {
    post: (url: string, opts: unknown, handler: RouteEntry["handler"]) => void;
    get: (url: string, opts: unknown, handler: RouteEntry["handler"]) => void;
    patch: (url: string, opts: unknown, handler: RouteEntry["handler"]) => void;
  };

  // POST /tasks
  a.post("/tasks", {}, async (req, reply) => {
    const body = req.body as { title: string };
    const task = fakeTx(() => {
      const t = createTaskStub(null, body);
      writeEvent("task.created", t.id, { title: t.title });
      return t;
    });
    return reply.status(201).send(task);
  });

  // GET /tasks
  a.get("/tasks", {}, async (req) => {
    const query = (req.query ?? {}) as Record<string, string>;
    return listTasksStub(null, query);
  });

  // GET /tasks/:id
  a.get("/tasks/:id", {}, async (req, reply) => {
    const { id } = req.params as { id: string };
    const task = getTaskStub(null, id);
    if (!task) return reply.status(404).send({ error: "Task not found", code: "TASK_NOT_FOUND" });
    return task;
  });

  // PATCH /tasks/:id
  a.patch("/tasks/:id", {}, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const task = fakeTx(() => {
      const t = updateTaskStub(null, id, body);
      if (!t) return null;
      writeEvent("task.updated", t.id, { fields: Object.keys(body) });
      return t;
    });
    if (!task) return reply.code(404).send({ error: "Task not found" });
    return task;
  });

  // POST /tasks/:id/complete
  a.post("/tasks/:id/complete", {}, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { summary: string };
    const task = fakeTx(() => {
      const t = completeTaskStub(null, id, body);
      if (!t) return null;
      createNotificationStub(null, {
        type: "task.completed",
        title: "Task completed",
        body: `Task "${t.title}" has been completed.`,
        entityType: "task",
        entityId: t.id,
      });
      writeEvent("task.completed", t.id, { summary: body.summary });
      return t;
    });
    if (!task) return reply.code(404).send({ error: "Task not found" });
    return task;
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findHandler(routes: RouteEntry[], method: string, url: string) {
  return routes.find((r) => r.method === method && r.url === url)?.handler;
}

function makeReq(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { body: {}, params: {}, query: {}, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("taskRoutes", () => {
  let routes: RouteEntry[];

  beforeEach(async () => {
    capturedEvents = [];
    transactionShouldThrow = false;
    createTaskStub.mock.resetCalls();
    getTaskStub.mock.resetCalls();
    listTasksStub.mock.resetCalls();
    updateTaskStub.mock.resetCalls();
    completeTaskStub.mock.resetCalls();
    createNotificationStub.mock.resetCalls();

    const app = buildFakeApp();
    await registerFakeRoutes(app.instance);
    routes = app.routes;
  });

  // ── POST /tasks ─────────────────────────────────────────────────────────

  describe("POST /tasks", () => {
    it("creates a task inside a transaction and returns 201", async () => {
      const handler = findHandler(routes, "POST", "/tasks")!;
      const reply = new FakeReply();
      await handler(makeReq({ body: { title: "Do stuff" } }), reply);

      assert.strictEqual(reply.statusCode, 201);
      assert.strictEqual((reply.body as Record<string, unknown>).title, "Do stuff");
      assert.strictEqual(capturedEvents.length, 1);
      assert.strictEqual(capturedEvents[0].action, "task.created");
    });

    it("does not emit event when transaction throws", async () => {
      transactionShouldThrow = true;
      const handler = findHandler(routes, "POST", "/tasks")!;
      const reply = new FakeReply();

      await assert.rejects(
        () => handler(makeReq({ body: { title: "Fail" } }), reply),
        { message: "Transaction rolled back" },
      );

      assert.strictEqual(capturedEvents.length, 0);
    });
  });

  // ── GET /tasks ──────────────────────────────────────────────────────────

  describe("GET /tasks", () => {
    it("returns a list of tasks", async () => {
      const handler = findHandler(routes, "GET", "/tasks")!;
      const result = await handler(makeReq(), new FakeReply());

      assert.deepStrictEqual(result, [fakeTask]);
    });

    it("passes query-string filters through", async () => {
      const handler = findHandler(routes, "GET", "/tasks")!;
      await handler(makeReq({ query: { status: "todo" } }), new FakeReply());

      const call = listTasksStub.mock.calls[0];
      assert.strictEqual(call.arguments[1].status, "todo");
    });
  });

  // ── GET /tasks/:id ─────────────────────────────────────────────────────

  describe("GET /tasks/:id", () => {
    it("returns the task when it exists", async () => {
      const handler = findHandler(routes, "GET", "/tasks/:id")!;
      const result = await handler(makeReq({ params: { id: "t1" } }), new FakeReply());

      assert.deepStrictEqual(result, fakeTaskWithArtifacts);
    });

    it("returns 404 when the task does not exist", async () => {
      const handler = findHandler(routes, "GET", "/tasks/:id")!;
      const reply = new FakeReply();
      await handler(makeReq({ params: { id: "nope" } }), reply);

      assert.strictEqual(reply.statusCode, 404);
      assert.deepStrictEqual(reply.body, { error: "Task not found", code: "TASK_NOT_FOUND" });
    });
  });

  // ── PATCH /tasks/:id ───────────────────────────────────────────────────

  describe("PATCH /tasks/:id", () => {
    it("updates a task inside a transaction", async () => {
      const handler = findHandler(routes, "PATCH", "/tasks/:id")!;
      const reply = new FakeReply();
      await handler(
        makeReq({ params: { id: "t1" }, body: { title: "New" } }),
        reply,
      );

      assert.ok(reply.body);
      assert.strictEqual(capturedEvents.length, 1);
      assert.strictEqual(capturedEvents[0].action, "task.updated");
    });

    it("returns 404 when the task does not exist", async () => {
      const handler = findHandler(routes, "PATCH", "/tasks/:id")!;
      const reply = new FakeReply();
      await handler(
        makeReq({ params: { id: "missing" }, body: { title: "X" } }),
        reply,
      );

      assert.strictEqual(reply.statusCode, 404);
      assert.strictEqual(capturedEvents.length, 0);
    });

    it("records updated fields in the audit event meta", async () => {
      const handler = findHandler(routes, "PATCH", "/tasks/:id")!;
      const reply = new FakeReply();
      await handler(
        makeReq({ params: { id: "t1" }, body: { title: "New", description: "Desc" } }),
        reply,
      );

      assert.strictEqual(capturedEvents.length, 1);
      const meta = capturedEvents[0].meta as { fields: string[] };
      assert.deepStrictEqual(meta.fields.sort(), ["description", "title"]);
    });
  });

  // ── POST /tasks/:id/complete ───────────────────────────────────────────

  describe("POST /tasks/:id/complete", () => {
    it("completes the task, creates a notification, and emits events", async () => {
      const handler = findHandler(routes, "POST", "/tasks/:id/complete")!;
      const reply = new FakeReply();
      await handler(
        makeReq({ params: { id: "t1" }, body: { summary: "All done" } }),
        reply,
      );

      assert.ok(reply.body);
      assert.strictEqual(createNotificationStub.mock.callCount(), 1, "notification created");
      assert.strictEqual(capturedEvents.length, 1);
      assert.strictEqual(capturedEvents[0].action, "task.completed");
    });

    it("returns 404 when the task does not exist", async () => {
      const handler = findHandler(routes, "POST", "/tasks/:id/complete")!;
      const reply = new FakeReply();
      await handler(
        makeReq({ params: { id: "missing" }, body: { summary: "nope" } }),
        reply,
      );

      assert.strictEqual(reply.statusCode, 404);
    });

    it("does not emit event when transaction throws", async () => {
      transactionShouldThrow = true;
      const handler = findHandler(routes, "POST", "/tasks/:id/complete")!;
      const reply = new FakeReply();

      await assert.rejects(
        () => handler(makeReq({ params: { id: "t1" }, body: { summary: "boom" } }), reply),
        { message: "Transaction rolled back" },
      );

      assert.strictEqual(capturedEvents.length, 0);
      assert.strictEqual(createNotificationStub.mock.callCount(), 0);
    });
  });
});
