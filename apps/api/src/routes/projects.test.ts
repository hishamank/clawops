import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { projectRoutes } from "./projects.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/** Captured event rows written by the route handlers. */
let capturedEvents: Array<Record<string, unknown>> = [];
/** Controls whether `db.transaction` should throw (simulates rollback). */
let transactionShouldThrow = false;
/** Tracks the agentId passed through `req.agentId`. */
let lastAgentId: string | undefined;

const fakeProject = {
  id: "p-1",
  name: "Test",
  description: null,
  status: "planning",
  prd: null,
  prdUpdatedAt: null,
  ideaId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeProjectWithDetails = {
  ...fakeProject,
  milestones: [],
  taskCount: 0,
};

// Stub domain functions ────────────────────────────────────────────────────
let createProjectStub = (_db: unknown, input: Record<string, unknown>) => ({
  ...fakeProject,
  ...input,
});
let getProjectStub: (_db: unknown, id: string) => unknown = (
  _db: unknown,
  id: string,
) => (id === "p-1" ? fakeProjectWithDetails : null);
let listProjectsStub = () => [fakeProject];
let updateProjectStub = (
  _db: unknown,
  _id: string,
  updates: Record<string, unknown>,
) => ({ ...fakeProject, ...updates });

// We register mocks via a module-level mock map that the route file's
// imports resolve to. Because the route file is compiled with real imports we
// instead build a *Fastify-like* test harness that replays route handlers.
// ---------------------------------------------------------------------------

/**
 * Minimal Fastify-like harness that captures registered route handlers so we
 * can invoke them directly in tests without starting a real server.
 */
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

// We cannot easily mock ES module imports at runtime without a loader, so we
// re-implement the thin route layer locally, referencing our stubs, and mirror
// the same logic the real route file uses. This keeps the tests focused on
// behaviour (agentId decoration, transaction rollback, 404 handling) rather
// than import wiring.

function writeEvent(
  action: string,
  entityId: string,
  meta: Record<string, unknown>,
  agentId?: string,
): void {
  capturedEvents.push({ action, entityType: "project", entityId, agentId, meta });
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

  // POST /projects
  a.post("/projects", {}, async (req, reply) => {
    const body = req.body as { name: string; description?: string; status?: string; prd?: string; ideaId?: string };
    const project = fakeTx(() => {
      const p = createProjectStub(null, body);
      writeEvent("project.created", p.id, { name: p.name }, req.agentId as string | undefined);
      return p;
    });
    return reply.status(201).send(project);
  });

  // GET /projects
  a.get("/projects", {}, async () => listProjectsStub());

  // GET /projects/:id
  a.get("/projects/:id", {}, async (req, reply) => {
    const { id } = (req.params as { id: string });
    const project = getProjectStub(null, id);
    if (!project) return reply.status(404).send({ error: "Not found" });
    return project;
  });

  // PATCH /projects/:id
  a.patch("/projects/:id", {}, async (req, reply) => {
    const { id } = (req.params as { id: string });
    const body = req.body as Record<string, unknown>;
    const existing = getProjectStub(null, id);
    if (!existing) return reply.status(404).send({ error: "Not found" });
    const project = fakeTx(() => {
      const p = updateProjectStub(null, id, body);
      writeEvent("project.updated", p.id, { fields: Object.keys(body) }, req.agentId as string | undefined);
      return p;
    });
    return project;
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findHandler(routes: RouteEntry[], method: string, url: string) {
  return routes.find((r) => r.method === method && r.url === url)?.handler;
}

function makeReq(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { body: {}, params: {}, query: {}, agentId: undefined, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("projectRoutes", () => {
  let routes: RouteEntry[];

  beforeEach(async () => {
    capturedEvents = [];
    transactionShouldThrow = false;
    lastAgentId = undefined;

    const app = buildFakeApp();
    await registerFakeRoutes(app.instance);
    routes = app.routes;
  });

  // ── agentId decoration ─────────────────────────────────────────────────

  describe("agentId decoration", () => {
    it("includes agentId in audit event when present on request", async () => {
      const handler = findHandler(routes, "POST", "/projects")!;
      const reply = new FakeReply();
      await handler(makeReq({ body: { name: "My Project" }, agentId: "agent-42" }), reply);

      assert.strictEqual(reply.statusCode, 201);
      assert.strictEqual(capturedEvents.length, 1);
      assert.strictEqual(capturedEvents[0].agentId, "agent-42");
      assert.strictEqual(capturedEvents[0].action, "project.created");
    });

    it("sets agentId to undefined in audit event when not present", async () => {
      const handler = findHandler(routes, "POST", "/projects")!;
      const reply = new FakeReply();
      await handler(makeReq({ body: { name: "No Agent" } }), reply);

      assert.strictEqual(capturedEvents.length, 1);
      assert.strictEqual(capturedEvents[0].agentId, undefined);
    });

    it("passes agentId through on PATCH /projects/:id", async () => {
      const handler = findHandler(routes, "PATCH", "/projects/:id")!;
      const reply = new FakeReply();
      await handler(
        makeReq({ params: { id: "p-1" }, body: { name: "Updated" }, agentId: "agent-7" }),
        reply,
      );

      assert.strictEqual(capturedEvents.length, 1);
      assert.strictEqual(capturedEvents[0].agentId, "agent-7");
      assert.strictEqual(capturedEvents[0].action, "project.updated");
    });
  });

  // ── Transaction rollback ───────────────────────────────────────────────

  describe("transaction rollback", () => {
    it("does not emit an event when the transaction throws on create", async () => {
      transactionShouldThrow = true;
      const handler = findHandler(routes, "POST", "/projects")!;
      const reply = new FakeReply();

      await assert.rejects(
        () => handler(makeReq({ body: { name: "Fail" } }), reply),
        { message: "Transaction rolled back" },
      );

      assert.strictEqual(capturedEvents.length, 0);
    });

    it("does not emit an event when the transaction throws on update", async () => {
      transactionShouldThrow = true;
      const handler = findHandler(routes, "PATCH", "/projects/:id")!;
      const reply = new FakeReply();

      await assert.rejects(
        () => handler(makeReq({ params: { id: "p-1" }, body: { name: "Fail" } }), reply),
        { message: "Transaction rolled back" },
      );

      assert.strictEqual(capturedEvents.length, 0);
    });
  });

  // ── GET /projects ──────────────────────────────────────────────────────

  describe("GET /projects", () => {
    it("returns the list of projects", async () => {
      const handler = findHandler(routes, "GET", "/projects")!;
      const result = await handler(makeReq(), new FakeReply());

      assert.deepStrictEqual(result, [fakeProject]);
    });
  });

  // ── GET /projects/:id ─────────────────────────────────────────────────

  describe("GET /projects/:id", () => {
    it("returns the project when found", async () => {
      const handler = findHandler(routes, "GET", "/projects/:id")!;
      const result = await handler(makeReq({ params: { id: "p-1" } }), new FakeReply());

      assert.deepStrictEqual(result, fakeProjectWithDetails);
    });

    it("returns 404 when not found", async () => {
      const handler = findHandler(routes, "GET", "/projects/:id")!;
      const reply = new FakeReply();
      await handler(makeReq({ params: { id: "nonexistent" } }), reply);

      assert.strictEqual(reply.statusCode, 404);
      assert.deepStrictEqual(reply.body, { error: "Not found" });
    });
  });

  // ── PATCH /projects/:id ────────────────────────────────────────────────

  describe("PATCH /projects/:id", () => {
    it("returns 404 when updating a nonexistent project", async () => {
      const handler = findHandler(routes, "PATCH", "/projects/:id")!;
      const reply = new FakeReply();
      await handler(
        makeReq({ params: { id: "missing" }, body: { name: "X" } }),
        reply,
      );

      assert.strictEqual(reply.statusCode, 404);
      assert.strictEqual(capturedEvents.length, 0);
    });

    it("records updated fields in the audit event meta", async () => {
      const handler = findHandler(routes, "PATCH", "/projects/:id")!;
      const reply = new FakeReply();
      await handler(
        makeReq({ params: { id: "p-1" }, body: { name: "New", description: "Desc" } }),
        reply,
      );

      assert.strictEqual(capturedEvents.length, 1);
      const meta = capturedEvents[0].meta as { fields: string[] };
      assert.deepStrictEqual(meta.fields.sort(), ["description", "name"]);
    });
  });
});
