import { describe, it, before } from "node:test";
import assert from "node:assert";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DB } from "@clawops/core";
import * as schema from "@clawops/core";
import { NotFoundError, ConflictError } from "@clawops/domain";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { createIdea, listIdeas, updateIdea, promoteIdeaToProject } = await import(
  "@clawops/ideas"
);

let db: DB;

before(() => {
  const sqlite = new Database(":memory:");
  db = drizzle(sqlite, { schema }) as DB;
  migrate(db, {
    migrationsFolder: path.resolve(__dirname, "../../core/migrations"),
  });
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
