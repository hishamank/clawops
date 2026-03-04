import { describe, it, mock, before, afterEach } from "node:test";
import assert from "node:assert";
import { NotFoundError, ConflictError } from "@clawops/domain";

// ── Fake data ──────────────────────────────────────────────────────────────

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

// ── Mock stubs ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
const createIdeaStub = mock.fn<(...a: any[]) => any>(
  (_db: unknown, input: Record<string, unknown>) => ({ ...fakeIdea, ...input }),
);
const listIdeasStub = mock.fn<(...a: any[]) => any>(() => [fakeIdea]);
const promoteIdeaToProjectStub = mock.fn<(...a: any[]) => any>(
  (_db: unknown, ideaId: string) => ({
    idea: { ...fakeIdea, id: ideaId, status: "promoted", projectId: "p1" },
    project: { id: "p1", name: fakeIdea.title },
  }),
);
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
    transaction: <T>(fn: () => T) => fn,
  },
};

// ── Set up module mocks BEFORE dynamic import ──────────────────────────────

mock.module("@clawops/core", {
  namedExports: { db: mockDb, events: mockEvents },
});

mock.module("@clawops/ideas", {
  namedExports: {
    createIdea: createIdeaStub,
    listIdeas: listIdeasStub,
    promoteIdeaToProject: promoteIdeaToProjectStub,
  },
});

// ── Dynamic import AFTER mocks ─────────────────────────────────────────────

const { ideaRoutes } = await import("./ideas.js");
const { default: Fastify } = await import("fastify");

// ── Tests ──────────────────────────────────────────────────────────────────

describe("ideaRoutes", () => {
  let app: ReturnType<typeof Fastify>;

  before(async () => {
    app = Fastify();
    await app.register(ideaRoutes);
    await app.ready();
  });

  afterEach(() => {
    capturedEventInserts.length = 0;
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
  });

  // ── POST /ideas ─────────────────────────────────────────────────────────

  describe("POST /ideas", () => {
    it("creates an idea inside a transaction and returns 201", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/ideas",
        body: { title: "Cool idea" },
      });

      assert.strictEqual(res.statusCode, 201);
      const body = res.json();
      assert.strictEqual(body.title, "Cool idea");
      assert.strictEqual(createIdeaStub.mock.callCount(), 1);
      assert.strictEqual(capturedEventInserts.length, 1);
      assert.strictEqual(capturedEventInserts[0].action, "idea.created");
    });
  });

  // ── GET /ideas ──────────────────────────────────────────────────────────

  describe("GET /ideas", () => {
    it("returns a list of ideas", async () => {
      const res = await app.inject({ method: "GET", url: "/ideas" });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.ok(Array.isArray(body));
      assert.strictEqual(body.length, 1);
    });

    it("passes query-string filters through", async () => {
      await app.inject({ method: "GET", url: "/ideas?status=raw" });

      const call = listIdeasStub.mock.calls[0];
      assert.strictEqual(call.arguments[1].status, "raw");
    });
  });

  // ── POST /ideas/:id/promote ─────────────────────────────────────────────

  describe("POST /ideas/:id/promote", () => {
    it("promotes an idea and emits two events inside a transaction", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/ideas/i1/promote",
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(capturedEventInserts.length, 2);
      assert.strictEqual(capturedEventInserts[0].action, "idea.promoted");
      assert.strictEqual(capturedEventInserts[1].action, "project.created");
    });

    it("returns 404 when the idea is not found (NotFoundError)", async () => {
      promoteIdeaToProjectStub.mock.mockImplementation(() => {
        throw new NotFoundError("Idea not found");
      });

      const res = await app.inject({
        method: "POST",
        url: "/ideas/missing/promote",
      });

      assert.strictEqual(res.statusCode, 404);
      const body = res.json();
      assert.strictEqual(body.code, "NOT_FOUND");
      assert.strictEqual(body.error, "Idea not found");
    });

    it("returns 409 when the idea has already been promoted (ConflictError)", async () => {
      promoteIdeaToProjectStub.mock.mockImplementation(() => {
        throw new ConflictError("Idea already promoted");
      });

      const res = await app.inject({
        method: "POST",
        url: "/ideas/i1/promote",
      });

      assert.strictEqual(res.statusCode, 409);
      const body = res.json();
      assert.strictEqual(body.code, "CONFLICT");
      assert.strictEqual(body.error, "Idea already promoted");
    });

    it("re-throws unexpected errors", async () => {
      promoteIdeaToProjectStub.mock.mockImplementation(() => {
        throw new Error("unexpected boom");
      });

      const res = await app.inject({
        method: "POST",
        url: "/ideas/i1/promote",
      });

      // Fastify catches unhandled errors and returns 500
      assert.strictEqual(res.statusCode, 500);
    });
  });
});
