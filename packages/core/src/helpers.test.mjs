import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../dist/index.js";

let db;

function createDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE agents (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      model text NOT NULL,
      role text NOT NULL,
      status text DEFAULT 'offline' NOT NULL,
      last_active integer,
      avatar text,
      framework text,
      api_key text,
      memory_path text,
      skills text,
      created_at integer DEFAULT (unixepoch()) NOT NULL
    );
    CREATE TABLE projects (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      description text,
      status text DEFAULT 'planning' NOT NULL,
      idea_id text,
      prd text,
      prd_updated_at integer,
      spec_content text,
      spec_updated_at integer,
      created_at integer DEFAULT (unixepoch()) NOT NULL
    );
    CREATE TABLE tasks (
      id text PRIMARY KEY NOT NULL,
      title text NOT NULL,
      description text,
      status text DEFAULT 'backlog' NOT NULL,
      priority text DEFAULT 'medium' NOT NULL,
      assignee_id text,
      project_id text,
      source text DEFAULT 'human' NOT NULL,
      due_date integer,
      completed_at integer,
      summary text,
      spec_content text,
      spec_updated_at integer,
      created_at integer DEFAULT (unixepoch()) NOT NULL,
      FOREIGN KEY (assignee_id) REFERENCES agents(id),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    CREATE TABLE activity_events (
      id text PRIMARY KEY NOT NULL,
      source text NOT NULL,
      severity text DEFAULT 'info' NOT NULL,
      type text NOT NULL,
      title text NOT NULL,
      body text,
      agent_id text,
      entity_type text,
      entity_id text,
      project_id text,
      task_id text,
      metadata text,
      created_at integer DEFAULT (unixepoch()) NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );
  `);
  const nextDb = drizzle(sqlite, { schema });
  return nextDb;
}

function seedAgent(id) {
  db.insert(schema.agents)
    .values({
      id,
      name: `Agent ${id}`,
      model: "gpt-4",
      role: "operator",
    })
    .run();
}

function seedProject(id) {
  db.insert(schema.projects)
    .values({
      id,
      name: `Project ${id}`,
    })
    .run();
}

function seedTask(id, projectId) {
  db.insert(schema.tasks)
    .values({
      id,
      title: `Task ${id}`,
      projectId,
    })
    .run();
}

beforeEach(() => {
  db = createDb();
  seedAgent("agent-1");
  seedProject("project-1");
  seedTask("task-1", "project-1");
});

describe("activity event helpers", () => {
  it("exports the full activity helper surface from @clawops/core", () => {
    assert.equal(typeof schema.createActivityEvent, "function");
    assert.equal(typeof schema.normalizeActivityEvent, "function");
    assert.equal(typeof schema.buildActivityEventQueryConditions, "function");
    assert.equal(typeof schema.parseActivityEventMetadata, "function");
  });

  it("createActivityEvent inserts and returns a normalized activity event", () => {
    const event = schema.createActivityEvent(db, {
      source: "system",
      severity: "warning",
      type: "sync.failed",
      title: "Sync failed",
      body: "Gateway request timed out",
      agentId: "agent-1",
      entityType: "task",
      entityId: "task-1",
      projectId: "project-1",
      taskId: "task-1",
      metadata: "{\"retry\":2,\"reason\":\"timeout\"}",
    });

    assert.ok(event.id);
    assert.equal(event.type, "sync.failed");
    assert.equal(event.metadata, "{\"retry\":2,\"reason\":\"timeout\"}");

    const persisted = db.select().from(schema.activityEvents).where(schema.eq(schema.activityEvents.id, event.id)).get();
    assert.ok(persisted);
    assert.equal(persisted.id, event.id);
  });

  it("normalizeActivityEvent rejects malformed metadata instead of silently replacing it", () => {
    assert.throws(
      () =>
        schema.normalizeActivityEvent({
          source: "system",
          severity: "info",
          type: "sync.started",
          title: "Sync started",
          metadata: "{bad json",
        }),
      /metadata must be a JSON object/i,
    );
  });

  it("normalizeActivityEvent rejects non-object JSON metadata", () => {
    assert.throws(
      () =>
        schema.normalizeActivityEvent({
          source: "system",
          severity: "info",
          type: "sync.started",
          title: "Sync started",
          metadata: "[1,2,3]",
        }),
      /metadata must be a JSON object/i,
    );
  });

  it("buildActivityEventQueryConditions supports the documented filters", () => {
    schema.createActivityEvent(db, {
      source: "sync",
      severity: "error",
      type: "sync.failed",
      title: "Sync failed",
      agentId: "agent-1",
      entityType: "task",
      entityId: "task-1",
      projectId: "project-1",
      taskId: "task-1",
      metadata: "{\"retry\":1}",
    });
    schema.createActivityEvent(db, {
      source: "workflow",
      severity: "info",
      type: "workflow.completed",
      title: "Workflow completed",
      metadata: "{\"steps\":3}",
    });

    const conditions = schema.buildActivityEventQueryConditions({
      type: "sync.failed",
      agentId: "agent-1",
      entityType: "task",
      entityId: "task-1",
      projectId: "project-1",
      taskId: "task-1",
      severity: "error",
      source: "sync",
    });

    const rows = db
      .select()
      .from(schema.activityEvents)
      .where(schema.and(...conditions))
      .all();

    assert.equal(rows.length, 1);
    assert.equal(rows[0].type, "sync.failed");
  });

  it("parseActivityEventMetadata returns parsed metadata objects", () => {
    const event = schema.createActivityEvent(db, {
      source: "hook",
      severity: "critical",
      type: "hook.failed",
      title: "Hook failed",
      metadata: "{\"attempt\":3,\"urgent\":true}",
    });

    assert.deepStrictEqual(schema.parseActivityEventMetadata(event), {
      attempt: 3,
      urgent: true,
    });
  });
});
