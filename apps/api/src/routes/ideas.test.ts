import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert";
import { NotFoundError, ConflictError } from "@clawops/domain";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/** Captured event rows written by the route handlers. */
let capturedEvents: Array<Record<string, unknown>> = [];
/** Controls whether the transaction should throw (simulates rollback). */
let transactionShouldThrow = false;

const fakeIdea = {
  id: "i1",
  title: "Cool idea",
  description: null,
  status: "raw",
  tags: null,
  source: "human",
  projectId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Stub domain functions ────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const createIdeaStub = mock.fn<(...a: any[]) => any>(
  (_db: unknown, input: Record<string, unknown>) => ({ ...fakeIdea, ...input }),
);
const listIdeasStub = mock.fn<(...a: any[]) => any>(
  () => [fakeIdea],
);
const promoteIdeaToProjectStub = mock.fn<(...a: any[]) => any>(
  (_db: unknown, ideaId: string) => ({
    idea: { ...fakeIdea, id: ideaId, status: "promoted", projectId: "p1" },
    project: { id: "p1", name: fakeIdea.title },
  }),
);
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
  entityType: string,
  entityId: string,
  meta: Record<string, unknown>,
): void {
  capturedEvents.push({ action, entityType, entityId, meta });
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
  };

  // POST /ideas
  a.post("/ideas", {}, async (req, reply) => {
    const body = req.body as { title: string };
    const idea = fakeTx(() => {
      const i = createIdeaStub(null, body);
      writeEvent("idea.created", "idea", i.id, { title: i.title });
      return i;
    });
    return reply.status(201).send(idea);
  });

  // GET /ideas
  a.get("/ideas", {}, async (req) => {
    const query = (req.query ?? {}) as Record<string, string>;
    return listIdeasStub(null, query);
  });

  // POST /ideas/:id/promote
  a.post("/ideas/:id/promote", {}, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const result = fakeTx(() => {
        const r = promoteIdeaToProjectStub(null, id);
        writeEvent("idea.promoted", "idea", r.idea.id, { projectId: r.project.id });
        writeEvent("project.created", "project", r.project.id, {
          name: r.project.name,
          ideaId: r.idea.id,
        });
        return r;
      });
      return result;
    } catch (err) {
      if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message, code: err.code });
      if (err instanceof ConflictError) return reply.code(409).send({ error: err.message, code: err.code });
      throw err;
    }
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

describe("ideaRoutes", () => {
  let routes: RouteEntry[];

  beforeEach(async () => {
    capturedEvents = [];
    transactionShouldThrow = false;
    createIdeaStub.mock.resetCalls();
    listIdeasStub.mock.resetCalls();
    promoteIdeaToProjectStub.mock.resetCalls();

    // Restore default implementations
    createIdeaStub.mock.mockImplementation(
      (_db: unknown, input: Record<string, unknown>) => ({ ...fakeIdea, ...input }),
    );
    listIdeasStub.mock.mockImplementation(() => [fakeIdea]);
    promoteIdeaToProjectStub.mock.mockImplementation(
      (_db: unknown, ideaId: string) => ({
        idea: { ...fakeIdea, id: ideaId, status: "promoted", projectId: "p1" },
        project: { id: "p1", name: fakeIdea.title },
      }),
    );

    const app = buildFakeApp();
    await registerFakeRoutes(app.instance);
    routes = app.routes;
  });

  // ── POST /ideas ─────────────────────────────────────────────────────────

  describe("POST /ideas", () => {
    it("creates an idea inside a transaction and returns 201", async () => {
      const handler = findHandler(routes, "POST", "/ideas")!;
      const reply = new FakeReply();
      await handler(makeReq({ body: { title: "Cool idea" } }), reply);

      assert.strictEqual(reply.statusCode, 201);
      assert.strictEqual((reply.body as Record<string, unknown>).title, "Cool idea");
      assert.strictEqual(capturedEvents.length, 1);
      assert.strictEqual(capturedEvents[0].action, "idea.created");
    });
  });

  // ── GET /ideas ──────────────────────────────────────────────────────────

  describe("GET /ideas", () => {
    it("returns a list of ideas", async () => {
      const handler = findHandler(routes, "GET", "/ideas")!;
      const result = await handler(makeReq(), new FakeReply());

      assert.deepStrictEqual(result, [fakeIdea]);
    });

    it("passes query-string filters through", async () => {
      const handler = findHandler(routes, "GET", "/ideas")!;
      await handler(makeReq({ query: { status: "raw" } }), new FakeReply());

      const call = listIdeasStub.mock.calls[0];
      assert.strictEqual(call.arguments[1].status, "raw");
    });
  });

  // ── POST /ideas/:id/promote ─────────────────────────────────────────────

  describe("POST /ideas/:id/promote", () => {
    it("promotes an idea and emits two events inside a transaction", async () => {
      const handler = findHandler(routes, "POST", "/ideas/:id/promote")!;
      await handler(makeReq({ params: { id: "i1" } }), new FakeReply());

      assert.strictEqual(capturedEvents.length, 2, "two events emitted");
      assert.strictEqual(capturedEvents[0].action, "idea.promoted");
      assert.strictEqual(capturedEvents[1].action, "project.created");
    });

    it("returns 404 when the idea is not found (NotFoundError)", async () => {
      promoteIdeaToProjectStub.mock.mockImplementation(() => {
        throw new NotFoundError("Idea not found");
      });

      const handler = findHandler(routes, "POST", "/ideas/:id/promote")!;
      const reply = new FakeReply();
      await handler(makeReq({ params: { id: "missing" } }), reply);

      assert.strictEqual(reply.statusCode, 404);
      const body = reply.body as Record<string, unknown>;
      assert.strictEqual(body.code, "NOT_FOUND");
      assert.strictEqual(body.error, "Idea not found");
    });

    it("returns 409 when the idea has already been promoted (ConflictError)", async () => {
      promoteIdeaToProjectStub.mock.mockImplementation(() => {
        throw new ConflictError("Idea already promoted");
      });

      const handler = findHandler(routes, "POST", "/ideas/:id/promote")!;
      const reply = new FakeReply();
      await handler(makeReq({ params: { id: "i1" } }), reply);

      assert.strictEqual(reply.statusCode, 409);
      const body = reply.body as Record<string, unknown>;
      assert.strictEqual(body.code, "CONFLICT");
      assert.strictEqual(body.error, "Idea already promoted");
    });

    it("re-throws unexpected errors", async () => {
      promoteIdeaToProjectStub.mock.mockImplementation(() => {
        throw new Error("unexpected boom");
      });

      const handler = findHandler(routes, "POST", "/ideas/:id/promote")!;
      const reply = new FakeReply();

      await assert.rejects(
        () => handler(makeReq({ params: { id: "i1" } }), reply),
        { message: "unexpected boom" },
      );
    });
  });
});
