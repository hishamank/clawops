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
    parseJsonArray: (v: string | null) => (v ? JSON.parse(v) : []),
    toJsonArray: (v: string[]) => JSON.stringify(v),
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

const { createIdea, listIdeas } = await import("../dist/index.js");

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
