import { describe, it, mock } from "node:test";
import assert from "node:assert";

/* eslint-disable @typescript-eslint/no-explicit-any */

const FAKE_IDEA = {
  id: "idea-1",
  title: "Test Idea",
  description: null,
  status: "raw",
  tags: null,
  projectId: null,
  source: "human",
  createdAt: new Date().toISOString(),
};

function makeChain(row: any = FAKE_IDEA, rows: any[] = [FAKE_IDEA]): any {
  const c: any = {
    all: () => rows,
    get: () => row,
    returning: () => c,
    where: () => c,
    from: () => c,
    values: () => c,
    set: () => c,
  };
  return c;
}

function makeDb(row?: any, rows?: any[]): any {
  const c = makeChain(row, rows);
  return { insert: () => c, select: () => c, update: () => c };
}

mock.module("@clawops/core", {
  namedExports: {
    db: makeDb(),
    ideas: Symbol("ideas"),
    projects: Symbol("projects"),
    tasks: Symbol("tasks"),
    parseJsonArray: (v: string | null) => (v ? JSON.parse(v) : []),
    parseJsonObject: (v: string | null) => (v ? JSON.parse(v) : {}),
    toJsonArray: (v: string[]) => JSON.stringify(v),
    toJsonObject: (v: Record<string, string | undefined>) => JSON.stringify(v),
    eq: () => ({}),
  },
});

mock.module("@clawops/domain", {
  namedExports: {
    NotFoundError: class NotFoundError extends Error {},
    ConflictError: class ConflictError extends Error {},
  },
});

mock.module("drizzle-orm", {
  namedExports: { eq: () => ({}) },
});

const { createIdea, listIdeas, listIdeaTasks, createIdeaTask } = await import("../dist/index.js");

describe("createIdea", () => {
  it("returns an idea row", () => {
    const result = createIdea(makeDb(), { title: "Test Idea" });
    assert.ok(result);
    assert.equal(result.id, "idea-1");
  });

  it("defaults source to human", () => {
    const result = createIdea(makeDb(), { title: "Test Idea" });
    assert.equal(result.source, "human");
  });
});

describe("listIdeas", () => {
  it("returns array of ideas", () => {
    const result = listIdeas(makeDb());
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 1);
  });

  it("filters by status when provided", () => {
    const result = listIdeas(makeDb(), { status: "raw" });
    assert.ok(Array.isArray(result));
  });

  it("filters by tag — includes matching tags", () => {
    const withTags = { ...FAKE_IDEA, tags: '["ux","hix"]' };
    const chain: any = {
      all: () => [withTags], get: () => withTags, returning: () => chain,
      where: () => chain, from: () => chain, values: () => chain, set: () => chain,
    };
    const db = { insert: () => chain, select: () => chain, update: () => chain };
    const result = listIdeas(db as any, { tag: "ux" });
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 1);
  });

  it("filters by tag — excludes non-matching tags", () => {
    const withTags = { ...FAKE_IDEA, tags: '["design"]' };
    const chain: any = {
      all: () => [withTags], get: () => withTags, returning: () => chain,
      where: () => chain, from: () => chain, values: () => chain, set: () => chain,
    };
    const db = { insert: () => chain, select: () => chain, update: () => chain };
    const result = listIdeas(db as any, { tag: "ux" });
    assert.equal(result.length, 0);
  });
});

// describe("listIdeaTasks", () => {
//   it("returns array of tasks for an idea", () => {
//     const taskChain: any = {
//       all: () => [{ id: "task-1", title: "Task 1", ideaId: "idea-1" }],
//       get: () => ({ id: "task-1" }),
//       returning: () => taskChain,
//       where: () => taskChain,
//       from: () => taskChain,
//       values: () => taskChain,
//       set: () => taskChain,
//     };
//     const db: any = { insert: () => taskChain, select: () => taskChain, update: () => taskChain };
//     const result = listIdeaTasks(db, "idea-1");
//     assert.ok(Array.isArray(result));
//     assert.equal(result.length, 1);
//     assert.equal(result[0].ideaId, "idea-1");
//   });
// 
//   it("filters by status when provided", () => {
//     const taskChain: any = {
//       all: () => [{ id: "task-1", title: "Task 1", ideaId: "idea-1", status: "todo" }],
//       get: () => ({ id: "task-1" }),
//       returning: () => taskChain,
//       where: () => taskChain,
//       from: () => taskChain,
//       values: () => taskChain,
//       set: () => taskChain,
//     };
//     const db: any = { insert: () => taskChain, select: () => taskChain, update: () => taskChain };
//     const result = listIdeaTasks(db, "idea-1", { status: "todo" });
//     assert.ok(Array.isArray(result));
//   });
// });

describe("createIdeaTask", () => {
  it("creates a task linked to an idea", () => {
    const ideaChain: any = {
      all: () => [{ id: "idea-1" }],
      get: () => ({ id: "idea-1" }),
      returning: () => ideaChain,
      where: () => ideaChain,
      from: () => ideaChain,
      values: () => ideaChain,
      set: () => ideaChain,
    };
    const taskChain: any = {
      all: () => [{ id: "task-1", title: "New Task", ideaId: "idea-1" }],
      get: () => ({ id: "task-1" }),
      returning: () => taskChain,
      where: () => taskChain,
      from: () => taskChain,
      values: () => taskChain,
      set: () => taskChain,
    };
    const db: any = { insert: () => taskChain, select: () => ideaChain, update: () => ideaChain };
    const result = createIdeaTask(db, "idea-1", { title: "New Task" });
    assert.ok(result);
    assert.equal(result.id, "task-1");
    assert.equal(result.ideaId, "idea-1");
  });

  it("throws NotFoundError if idea does not exist", () => {
    const ideaChain: any = {
      all: () => [],
      get: () => undefined,
      returning: () => ideaChain,
      where: () => ideaChain,
      from: () => ideaChain,
      values: () => ideaChain,
      set: () => ideaChain,
    };
    const db: any = { insert: () => ideaChain, select: () => ideaChain, update: () => ideaChain };
    assert.throws(() => createIdeaTask(db, "nonexistent", { title: "Task" }));
  });

  it("defaults priority to medium", () => {
    const ideaChain: any = {
      all: () => [{ id: "idea-1" }],
      get: () => ({ id: "idea-1" }),
      returning: () => ideaChain,
      where: () => ideaChain,
      from: () => ideaChain,
      values: () => ideaChain,
      set: () => ideaChain,
    };
    const taskChain: any = {
      all: () => [{ id: "task-1", title: "New Task", ideaId: "idea-1", priority: "medium" }],
      get: () => ({ id: "task-1" }),
      returning: () => taskChain,
      where: () => taskChain,
      from: () => taskChain,
      values: () => taskChain,
      set: () => taskChain,
    };
    const db: any = { insert: () => taskChain, select: () => ideaChain, update: () => ideaChain };
    const result = createIdeaTask(db, "idea-1", { title: "New Task" });
    assert.equal(result.priority, "medium");
  });

  it("defaults source to human", () => {
    const ideaChain: any = {
      all: () => [{ id: "idea-1" }],
      get: () => ({ id: "idea-1" }),
      returning: () => ideaChain,
      where: () => ideaChain,
      from: () => ideaChain,
      values: () => ideaChain,
      set: () => ideaChain,
    };
    const taskChain: any = {
      all: () => [{ id: "task-1", title: "New Task", ideaId: "idea-1", source: "human" }],
      get: () => ({ id: "task-1" }),
      returning: () => taskChain,
      where: () => taskChain,
      from: () => taskChain,
      values: () => taskChain,
      set: () => taskChain,
    };
    const db: any = { insert: () => taskChain, select: () => ideaChain, update: () => ideaChain };
    const result = createIdeaTask(db, "idea-1", { title: "New Task" });
    assert.equal(result.source, "human");
  });
});
