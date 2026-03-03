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

const createIdeaMock = mock.fn<(...a: any[]) => any>();
const listIdeasMock = mock.fn<(...a: any[]) => any>();
const promoteIdeaToProjectMock = mock.fn<(...a: any[]) => any>();
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Module mocks (must precede dynamic import) ─────────────────────────────

mock.module("@clawops/core", {
  namedExports: { db: fakeDb, events: fakeEvents },
});

mock.module("@clawops/ideas", {
  namedExports: {
    createIdea: createIdeaMock,
    listIdeas: listIdeasMock,
    promoteIdeaToProject: promoteIdeaToProjectMock,
  },
});

// Domain enums + errors – pass through unchanged.
const { NotFoundError, ConflictError, IdeaStatus } = await import("@clawops/domain");

// Now import the code under test + Fastify.
const { ideaRoutes } = await import("./ideas.js");
const Fastify = (await import("fastify")).default;

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildApp() {
  const app = Fastify();
  app.register(ideaRoutes);
  return app;
}

function resetMocks() {
  createIdeaMock.mock.resetCalls();
  listIdeasMock.mock.resetCalls();
  promoteIdeaToProjectMock.mock.resetCalls();
  insertFn.mock.resetCalls();
  insertValues.mock.resetCalls();
  insertRun.mock.resetCalls();
  transactionFn.mock.resetCalls();
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("POST /ideas", () => {
  beforeEach(resetMocks);

  it("creates an idea inside a transaction and returns 201", async () => {
    const idea = { id: "i1", title: "Cool idea" };
    createIdeaMock.mock.mockImplementation(() => idea);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/ideas",
      payload: { title: "Cool idea" },
    });

    assert.strictEqual(res.statusCode, 201);
    assert.deepStrictEqual(JSON.parse(res.body), idea);
    assert.strictEqual(transactionFn.mock.callCount(), 1, "mutation wrapped in transaction");
    assert.strictEqual(insertFn.mock.callCount(), 1, "writeEvent called");
  });
});

describe("GET /ideas", () => {
  beforeEach(resetMocks);

  it("returns a list of ideas", async () => {
    const ideas = [{ id: "i1" }, { id: "i2" }];
    listIdeasMock.mock.mockImplementation(() => ideas);

    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/ideas" });

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(res.body), ideas);
  });

  it("passes query-string filters through", async () => {
    listIdeasMock.mock.mockImplementation(() => []);

    const app = buildApp();
    await app.inject({ method: "GET", url: `/ideas?status=${IdeaStatus.raw}` });

    const call = listIdeasMock.mock.calls[0];
    assert.strictEqual(call.arguments[1].status, IdeaStatus.raw);
  });
});

describe("POST /ideas/:id/promote", () => {
  beforeEach(resetMocks);

  it("promotes an idea and emits two events inside a transaction", async () => {
    const result = {
      idea: { id: "i1", title: "Great idea" },
      project: { id: "p1", name: "Great idea" },
    };
    promoteIdeaToProjectMock.mock.mockImplementation(() => result);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/ideas/i1/promote",
    });

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(res.body), result);
    assert.strictEqual(transactionFn.mock.callCount(), 1, "wrapped in transaction");
    // Two writeEvent calls: idea.promoted + project.created
    assert.strictEqual(insertFn.mock.callCount(), 2, "two events written");
  });

  it("returns 404 when the idea is not found (NotFoundError)", async () => {
    promoteIdeaToProjectMock.mock.mockImplementation(() => {
      throw new NotFoundError("Idea not found");
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/ideas/missing/promote",
    });

    assert.strictEqual(res.statusCode, 404);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.code, "NOT_FOUND");
    assert.strictEqual(body.error, "Idea not found");
  });

  it("returns 409 when the idea has already been promoted (ConflictError)", async () => {
    promoteIdeaToProjectMock.mock.mockImplementation(() => {
      throw new ConflictError("Idea already promoted");
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/ideas/i1/promote",
    });

    assert.strictEqual(res.statusCode, 409);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.code, "CONFLICT");
    assert.strictEqual(body.error, "Idea already promoted");
  });

  it("re-throws unexpected errors", async () => {
    promoteIdeaToProjectMock.mock.mockImplementation(() => {
      throw new Error("unexpected boom");
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/ideas/i1/promote",
    });

    assert.strictEqual(res.statusCode, 500);
  });
});
