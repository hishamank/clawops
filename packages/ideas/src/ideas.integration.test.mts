import { describe, it, before } from "node:test";
import assert from "node:assert";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { DB } from "@clawops/core";
import * as schema from "@clawops/core";
import { NotFoundError, ConflictError } from "@clawops/domain";

const {
  IDEA_SECTION_KEYS,
  createIdea,
  getIdeaDraftPrd,
  getIdeaSection,
  getIdeaSections,
  listIdeas,
  promoteIdeaToProject,
  setIdeaDraftPrd,
  updateIdea,
  updateIdeaSection,
  updateIdeaSections,
} = await import(
  "@clawops/ideas"
);

let db: DB;

before(() => {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE ideas (
      id text PRIMARY KEY NOT NULL,
      title text NOT NULL,
      description text,
      status text NOT NULL DEFAULT 'raw',
      tags text,
      sections text,
      project_id text,
      source text NOT NULL DEFAULT 'human',
      created_at integer NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE projects (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      description text,
      status text NOT NULL DEFAULT 'planning',
      idea_id text,
      prd text,
      prd_updated_at integer,
      spec_content text,
      spec_updated_at integer,
      created_at integer NOT NULL DEFAULT (unixepoch())
    );
  `);
  db = drizzle(sqlite, { schema }) as DB;
});

describe("ideas (integration)", () => {
  it("createIdea inserts a row and returns it", () => {
    const idea = createIdea(db, { title: "Integration idea" });

    assert.ok(idea.id);
    assert.strictEqual(idea.title, "Integration idea");
    assert.strictEqual(idea.status, "raw");
    assert.strictEqual(idea.source, "human");
    assert.ok(idea.createdAt);
  });

  it("createIdea stores tags as JSON", () => {
    const idea = createIdea(db, {
      title: "Tagged idea",
      tags: ["frontend", "ux"],
    });

    assert.ok(idea.tags);
    const parsed = JSON.parse(idea.tags);
    assert.deepStrictEqual(parsed, ["frontend", "ux"]);
  });

  it("listIdeas returns all ideas", () => {
    const all = listIdeas(db);
    assert.ok(all.length >= 2);
  });

  it("listIdeas filters by status", () => {
    const raw = listIdeas(db, { status: "raw" });
    assert.ok(raw.length >= 1);
    assert.ok(raw.every((i) => i.status === "raw"));
  });

  it("listIdeas filters by tag", () => {
    const tagged = listIdeas(db, { tag: "frontend" });
    assert.ok(tagged.length >= 1);
  });

  it("updateIdea modifies fields", () => {
    const idea = createIdea(db, { title: "Old title" });
    const updated = updateIdea(db, idea.id, { title: "New title" });

    assert.strictEqual(updated.title, "New title");
  });

  it("getIdeaSections returns an empty object when the idea has no sections yet", () => {
    const idea = createIdea(db, { title: "Blank sections" });

    assert.deepStrictEqual(getIdeaSections(db, idea.id), {});
  });

  it("getIdeaSections throws NotFoundError for nonexistent ideas", () => {
    assert.throws(
      () => getIdeaSections(db, "missing-idea"),
      (err: unknown) => err instanceof NotFoundError,
    );
  });

  it("stores and reads only the structured section keys", () => {
    const idea = createIdea(db, { title: "Sectioned idea" });
    updateIdeaSections(db, idea.id, {
      brainstorming: "Brainstorm",
      research: "Research",
      similarIdeas: "Similar",
      draftPrd: "PRD",
      notes: "Notes",
    });

    const sections = getIdeaSections(db, idea.id);

    assert.deepStrictEqual(Object.keys(sections).sort(), [...IDEA_SECTION_KEYS].sort());
    assert.strictEqual(getIdeaSection(db, idea.id, "research"), "Research");
  });

  it("updateIdeaSection throws NotFoundError for nonexistent ideas", () => {
    assert.throws(
      () => updateIdeaSection(db, "missing-idea", "brainstorming", "content"),
      (err: unknown) => err instanceof NotFoundError,
    );
  });

  it("setIdeaDraftPrd updates and reads the draft PRD section", () => {
    const idea = createIdea(db, { title: "Draft PRD idea" });
    setIdeaDraftPrd(db, idea.id, "Draft PRD content");

    assert.strictEqual(getIdeaDraftPrd(db, idea.id), "Draft PRD content");
  });

  it("promoteIdeaToProject creates a project and marks idea promoted", () => {
    const idea = createIdea(db, { title: "Promote me", description: "A great idea" });
    const result = promoteIdeaToProject(db, idea.id);

    assert.strictEqual(result.idea.status, "promoted");
    assert.ok(result.idea.projectId);
    assert.strictEqual(result.project.name, "Promote me");
    assert.strictEqual(result.project.id, result.idea.projectId);
  });

  it("promoteIdeaToProject throws NotFoundError for nonexistent idea", () => {
    assert.throws(
      () => promoteIdeaToProject(db, "nonexistent-id"),
      (err: unknown) => err instanceof NotFoundError,
    );
  });

  it("promoteIdeaToProject throws ConflictError for already promoted idea", () => {
    const idea = createIdea(db, { title: "Already promoted" });
    promoteIdeaToProject(db, idea.id);

    assert.throws(
      () => promoteIdeaToProject(db, idea.id),
      (err: unknown) => err instanceof ConflictError,
    );
  });
});
