import { describe, it, mock } from "node:test";
import assert from "node:assert";

/* eslint-disable @typescript-eslint/no-explicit-any */

const FAKE_PROJECT = {
  id: "proj-1",
  name: "Test Project",
  description: null,
  status: "planning",
  prd: null,
  prdUpdatedAt: null,
  ideaId: null,
  createdAt: new Date().toISOString(),
};

function makeChain(row: any = FAKE_PROJECT, rows: any[] = [FAKE_PROJECT]): any {
  const c: any = {
    all: () => rows,
    get: () => row,
    returning: () => c,
    where: () => c,
    from: () => c,
    values: () => c,
    set: () => c,
    orderBy: () => c,
  };
  return c;
}

function makeDb(row?: any, rows?: any[]): any {
  const c = makeChain(row, rows);
  return { insert: () => c, select: () => c, update: () => c, delete: () => c };
}

mock.module("@clawops/core", {
  namedExports: {
    db: makeDb(),
    projects: Symbol("projects"),
    milestones: Symbol("milestones"),
    tasks: Symbol("tasks"),
    eq: () => ({}),
    and: () => ({}),
    count: () => Symbol("count"),
  },
});

mock.module("@clawops/domain", {
  namedExports: {
    NotFoundError: class NotFoundError extends Error {},
    ConflictError: class ConflictError extends Error {},
  },
});

mock.module("drizzle-orm", {
  namedExports: {
    eq: () => ({}),
    and: () => ({}),
    count: () => Symbol("count"),
  },
});

const { createProject, getProject, listProjects } = await import("../dist/index.js");

describe("createProject", () => {
  it("returns a project row", () => {
    const result = createProject(makeDb(), { name: "Test Project" });
    assert.ok(result);
    assert.equal(result.id, "proj-1");
    assert.equal(result.name, "Test Project");
  });

  it("defaults status to planning", () => {
    const result = createProject(makeDb(), { name: "New Project" });
    assert.equal(result.status, "planning");
  });
});

describe("getProject", () => {
  it("returns project with milestones and taskCount when found", () => {
    const result = getProject(makeDb(), "proj-1");
    assert.ok(result);
    assert.ok(Array.isArray((result as any).milestones));
    assert.ok(typeof (result as any).taskCount === "number");
  });

  it("returns null when not found", () => {
    const nullChain: any = {
      all: () => [], get: () => null, returning: () => nullChain,
      where: () => nullChain, from: () => nullChain, orderBy: () => nullChain,
      values: () => nullChain, set: () => nullChain,
    };
    const db = { insert: () => nullChain, select: () => nullChain, update: () => nullChain };
    const result = getProject(db as any, "nonexistent");
    assert.equal(result, null);
  });
});

describe("listProjects", () => {
  it("returns array of projects", () => {
    const result = listProjects(makeDb());
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 1);
  });
});
