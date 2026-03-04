import { describe, it, before } from "node:test";
import assert from "node:assert";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DB } from "@clawops/core";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  createProject,
  getProject,
  listProjects,
  updateProject,
  createMilestone,
  updateMilestone,
  reorderMilestones,
  getProjectProgress,
} = await import("@clawops/projects");

let db: DB;

before(() => {
  const sqlite = new Database(":memory:");
  db = drizzle(sqlite) as unknown as DB;
  migrate(db, {
    migrationsFolder: path.resolve(__dirname, "../../core/migrations"),
  });
});

describe("projects (integration)", () => {
  it("createProject inserts a row and returns it", () => {
    const project = createProject(db, { name: "Integration project" });

    assert.ok(project.id);
    assert.strictEqual(project.name, "Integration project");
    assert.strictEqual(project.status, "planning");
    assert.ok(project.createdAt);
  });

  it("getProject returns the project with milestones and taskCount", () => {
    const created = createProject(db, { name: "Fetch me" });
    const fetched = getProject(db, created.id);

    assert.ok(fetched);
    assert.strictEqual(fetched.id, created.id);
    assert.strictEqual(fetched.name, "Fetch me");
    assert.deepStrictEqual(fetched.milestones, []);
    assert.strictEqual(fetched.taskCount, 0);
  });

  it("getProject returns null for nonexistent ID", () => {
    const result = getProject(db, "nonexistent-id");
    assert.strictEqual(result, null);
  });

  it("listProjects returns all projects", () => {
    const all = listProjects(db);
    assert.ok(all.length >= 2);
  });

  it("updateProject modifies fields", () => {
    const project = createProject(db, { name: "Old name" });
    const updated = updateProject(db, project.id, { name: "New name", status: "active" });

    assert.strictEqual(updated.name, "New name");
    assert.strictEqual(updated.status, "active");
  });

  it("updateProject sets prdUpdatedAt when prd changes", () => {
    const project = createProject(db, { name: "PRD project" });
    const updated = updateProject(db, project.id, { prd: "# Project spec" });

    assert.strictEqual(updated.prd, "# Project spec");
    assert.ok(updated.prdUpdatedAt);
  });

  it("createMilestone auto-increments order", () => {
    const project = createProject(db, { name: "Milestone project" });
    const m1 = createMilestone(db, project.id, { title: "First" });
    const m2 = createMilestone(db, project.id, { title: "Second" });

    assert.strictEqual(m1.order, 0);
    assert.strictEqual(m2.order, 1);
  });

  it("updateMilestone modifies fields", () => {
    const project = createProject(db, { name: "Update MS" });
    const m = createMilestone(db, project.id, { title: "Original" });
    const updated = updateMilestone(db, m.id, { title: "Updated", status: "done" });

    assert.strictEqual(updated.title, "Updated");
    assert.strictEqual(updated.status, "done");
  });

  it("reorderMilestones changes order", () => {
    const project = createProject(db, { name: "Reorder" });
    const m1 = createMilestone(db, project.id, { title: "A" });
    const m2 = createMilestone(db, project.id, { title: "B" });

    const reordered = reorderMilestones(db, project.id, [m2.id, m1.id]);
    assert.strictEqual(reordered[0].order, 0); // m2 now first
    assert.strictEqual(reordered[1].order, 1); // m1 now second
  });

  it("getProjectProgress returns zero for empty project", () => {
    const project = createProject(db, { name: "Empty" });
    const progress = getProjectProgress(db, project.id);

    assert.strictEqual(progress.total, 0);
    assert.strictEqual(progress.completed, 0);
    assert.strictEqual(progress.percent, 0);
  });
});
