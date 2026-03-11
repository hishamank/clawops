import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DB } from "@clawops/core";
import * as schema from "@clawops/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  initAgent,
  upsertOpenClawAgentIdentity,
  getAgentByOpenClawIdentity,
} = await import("@clawops/agents");

let db: DB;

function freshDb(): DB {
  const sqlite = new Database(":memory:");
  const d = drizzle(sqlite, { schema }) as DB;
  migrate(d, {
    migrationsFolder: path.resolve(__dirname, "../../core/migrations"),
  });
  // Seed a connection record so FK constraints pass
  sqlite.exec(
    `INSERT INTO openclaw_connections (id, provider, name, root_path)
     VALUES ('conn-1', 'openclaw', 'test', '/tmp/test')`,
  );
  return d;
}

before(() => {
  db = freshDb();
});

describe("initAgent", () => {
  beforeEach(() => {
    db = freshDb();
  });

  it("creates a new agent when none exists (create path)", () => {
    const result = initAgent(db, {
      name: "Alice",
      model: "gpt-4",
      role: "assistant",
      framework: "openclaw",
    });

    assert.ok(result.created);
    assert.ok(result.apiKey);
    assert.equal(result.agent.name, "Alice");
    assert.equal(result.agent.model, "gpt-4");
    assert.equal(result.agent.status, "offline");
  });

  it("creates agent with openclaw mapping upsert (create path)", () => {
    const result = initAgent(db, {
      name: "Bob",
      model: "claude-3",
      role: "coder",
      framework: "openclaw",
      openclaw: {
        connectionId: "conn-1",
        externalAgentId: "ext-bob",
        externalAgentName: "Bob External",
      },
    });

    assert.ok(result.created);
    assert.ok(result.apiKey);

    // Verify the mapping was created
    const found = getAgentByOpenClawIdentity(db, {
      connectionId: "conn-1",
      externalAgentId: "ext-bob",
    });
    assert.ok(found);
    assert.equal(found.id, result.agent.id);
  });

  it("returns existing agent when found by openclaw identity (existing mapping)", () => {
    // First create
    const first = initAgent(db, {
      name: "Charlie",
      model: "gpt-4",
      role: "agent",
      framework: "openclaw",
      openclaw: {
        connectionId: "conn-1",
        externalAgentId: "ext-charlie",
        externalAgentName: "Charlie v1",
      },
    });
    assert.ok(first.created);

    // Second call with same openclaw identity but different name (rename)
    const second = initAgent(db, {
      name: "Charlie Renamed",
      model: "gpt-4o",
      role: "agent",
      framework: "openclaw",
      openclaw: {
        connectionId: "conn-1",
        externalAgentId: "ext-charlie",
        externalAgentName: "Charlie v2",
      },
    });

    assert.equal(second.created, false);
    assert.equal(second.apiKey, undefined);
    assert.equal(second.agent.id, first.agent.id);
    // Agent fields should be updated
    assert.equal(second.agent.name, "Charlie Renamed");
    assert.equal(second.agent.model, "gpt-4o");
  });

  it("updates existing agent and upserts openclaw mapping in conflict/update case", () => {
    // Create agent without openclaw
    const first = initAgent(db, {
      name: "Delta",
      model: "gpt-4",
      role: "agent",
      framework: "openclaw",
    });
    assert.ok(first.created);

    // Now call with openclaw identity — should find by name+framework, update, and upsert mapping
    const second = initAgent(db, {
      name: "Delta",
      model: "claude-3",
      role: "coder",
      framework: "openclaw",
      openclaw: {
        connectionId: "conn-1",
        externalAgentId: "ext-delta",
        externalAgentName: "Delta External",
      },
    });

    assert.equal(second.created, false);
    assert.equal(second.agent.id, first.agent.id);
    assert.equal(second.agent.model, "claude-3");

    // Verify mapping was created
    const found = getAgentByOpenClawIdentity(db, {
      connectionId: "conn-1",
      externalAgentId: "ext-delta",
    });
    assert.ok(found);
    assert.equal(found.id, first.agent.id);
  });

  it("falls back to name+framework when no openclaw input is provided", () => {
    // Create agent
    const first = initAgent(db, {
      name: "Echo",
      model: "gpt-4",
      role: "agent",
      framework: "langchain",
    });
    assert.ok(first.created);

    // Second call with same name+framework, no openclaw
    const second = initAgent(db, {
      name: "Echo",
      model: "gpt-4o",
      role: "coder",
      framework: "langchain",
    });

    assert.equal(second.created, false);
    assert.equal(second.agent.id, first.agent.id);
    assert.equal(second.agent.model, "gpt-4o");
    assert.equal(second.agent.role, "coder");
  });

  it("creates a new agent when name+framework has multiple matches (no unique match)", () => {
    // Manually insert two agents with same name+framework
    db.insert(schema.agents)
      .values({
        name: "Dup",
        model: "m1",
        role: "r",
        framework: "fw",
        status: "offline",
      })
      .run();
    db.insert(schema.agents)
      .values({
        name: "Dup",
        model: "m2",
        role: "r",
        framework: "fw",
        status: "offline",
      })
      .run();

    // initAgent with same name+framework but no openclaw — should create new since no unique match
    const result = initAgent(db, {
      name: "Dup",
      model: "m3",
      role: "r",
      framework: "fw",
    });

    assert.ok(result.created);
    assert.equal(result.agent.model, "m3");
  });
});

describe("upsertOpenClawAgentIdentity", () => {
  beforeEach(() => {
    db = freshDb();
  });

  it("inserts a new mapping and returns it", () => {
    // Create an agent first
    const agent = initAgent(db, {
      name: "Foxtrot",
      model: "gpt-4",
      role: "agent",
      framework: "openclaw",
    });

    const mapping = upsertOpenClawAgentIdentity(db, {
      connectionId: "conn-1",
      externalAgentId: "ext-fox",
      externalAgentName: "Foxtrot Ext",
      linkedAgentId: agent.agent.id,
    });

    assert.ok(mapping.id);
    assert.equal(mapping.connectionId, "conn-1");
    assert.equal(mapping.externalAgentId, "ext-fox");
    assert.equal(mapping.linkedAgentId, agent.agent.id);
  });

  it("updates on conflict and returns the updated row", () => {
    const agent = initAgent(db, {
      name: "Golf",
      model: "gpt-4",
      role: "agent",
      framework: "openclaw",
    });

    // First upsert
    const first = upsertOpenClawAgentIdentity(db, {
      connectionId: "conn-1",
      externalAgentId: "ext-golf",
      externalAgentName: "Golf v1",
      linkedAgentId: agent.agent.id,
    });

    // Second upsert with same key, different name
    const second = upsertOpenClawAgentIdentity(db, {
      connectionId: "conn-1",
      externalAgentId: "ext-golf",
      externalAgentName: "Golf v2",
      linkedAgentId: agent.agent.id,
    });

    assert.equal(second.connectionId, first.connectionId);
    assert.equal(second.externalAgentId, first.externalAgentId);
    assert.equal(second.externalAgentName, "Golf v2");
  });
});
