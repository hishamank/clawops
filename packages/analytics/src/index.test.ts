import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@clawops/core";
import { agents, projects, tasks } from "@clawops/core";
import {
  logUsage,
  getTokenStats,
  getCostByProject,
  getDailySpend,
} from "./index.js";

function createTestDB() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = OFF"); // simplify test setup

  // Create the tables we need
  sqlite.exec(`
    CREATE TABLE agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      model TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'offline',
      last_active INTEGER,
      avatar TEXT,
      framework TEXT,
      api_key TEXT UNIQUE,
      memory_path TEXT,
      skills TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'planning',
      idea_id TEXT,
      prd TEXT,
      prd_updated_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'backlog',
      priority TEXT NOT NULL DEFAULT 'medium',
      assignee_id TEXT,
      project_id TEXT,
      source TEXT NOT NULL DEFAULT 'human',
      due_date INTEGER,
      completed_at INTEGER,
      summary TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE usage_logs (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      task_id TEXT,
      model TEXT NOT NULL,
      tokens_in INTEGER NOT NULL DEFAULT 0,
      tokens_out INTEGER NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  return drizzle(sqlite, { schema: { ...schema } });
}

function seedAgent(db: ReturnType<typeof createTestDB>, id = "agent-1") {
  db.insert(agents)
    .values({ id, name: "Test Agent", model: "claude-sonnet-4-6", role: "coder" })
    .run();
}

function seedProject(db: ReturnType<typeof createTestDB>, id = "proj-1") {
  db.insert(projects).values({ id, name: "Test Project" }).run();
}

function seedTask(
  db: ReturnType<typeof createTestDB>,
  id = "task-1",
  projectId: string | null = null,
) {
  db.insert(tasks)
    .values({ id, title: "Test Task", projectId })
    .run();
}

// ── logUsage ────────────────────────────────────────────────────────────────

describe("logUsage", () => {
  let db: ReturnType<typeof createTestDB>;

  beforeEach(() => {
    db = createTestDB();
    seedAgent(db);
  });

  it("inserts a usage log and returns the row", () => {
    const result = logUsage(db, {
      agentId: "agent-1",
      model: "claude-sonnet-4-6",
      tokensIn: 1000,
      tokensOut: 500,
    });

    assert.strictEqual(result.agentId, "agent-1");
    assert.strictEqual(result.model, "claude-sonnet-4-6");
    assert.strictEqual(result.tokensIn, 1000);
    assert.strictEqual(result.tokensOut, 500);
    assert.ok(result.id, "should have an id");
    assert.ok(typeof result.cost === "number", "should have a numeric cost");
  });

  it("throws when insert returns 0 rows", () => {
    // Use a mock db that returns empty rows from .all()
    const mockDB = {
      insert: () => ({
        values: () => ({
          returning: () => ({
            all: () => [],
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createTestDB>;

    assert.throws(
      () =>
        logUsage(mockDB, {
          agentId: "agent-1",
          model: "claude-sonnet-4-6",
          tokensIn: 100,
          tokensOut: 50,
        }),
      { message: "Failed to insert usageLog" },
    );
  });
});

// ── getTokenStats ───────────────────────────────────────────────────────────

describe("getTokenStats", () => {
  let db: ReturnType<typeof createTestDB>;

  beforeEach(() => {
    db = createTestDB();
    seedAgent(db, "agent-1");
    seedAgent(db, "agent-2");
  });

  it("returns zeros when no rows exist", () => {
    const stats = getTokenStats(db);
    assert.deepStrictEqual(stats, {
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalCost: 0,
      count: 0,
    });
  });

  it("returns aggregated stats for all rows when no filter", () => {
    logUsage(db, {
      agentId: "agent-1",
      model: "claude-sonnet-4-6",
      tokensIn: 1000,
      tokensOut: 500,
    });
    logUsage(db, {
      agentId: "agent-2",
      model: "claude-sonnet-4-6",
      tokensIn: 2000,
      tokensOut: 1000,
    });

    const stats = getTokenStats(db);
    assert.strictEqual(stats.totalTokensIn, 3000);
    assert.strictEqual(stats.totalTokensOut, 1500);
    assert.strictEqual(stats.count, 2);
  });

  it("filters by agentId", () => {
    logUsage(db, {
      agentId: "agent-1",
      model: "claude-sonnet-4-6",
      tokensIn: 1000,
      tokensOut: 500,
    });
    logUsage(db, {
      agentId: "agent-2",
      model: "claude-sonnet-4-6",
      tokensIn: 2000,
      tokensOut: 1000,
    });

    const stats = getTokenStats(db, { agentId: "agent-1" });
    assert.strictEqual(stats.totalTokensIn, 1000);
    assert.strictEqual(stats.totalTokensOut, 500);
    assert.strictEqual(stats.count, 1);
  });

  it("filters by model", () => {
    logUsage(db, {
      agentId: "agent-1",
      model: "claude-sonnet-4-6",
      tokensIn: 1000,
      tokensOut: 500,
    });
    logUsage(db, {
      agentId: "agent-1",
      model: "gpt-4o",
      tokensIn: 2000,
      tokensOut: 1000,
    });

    const stats = getTokenStats(db, { model: "gpt-4o" });
    assert.strictEqual(stats.totalTokensIn, 2000);
    assert.strictEqual(stats.totalTokensOut, 1000);
    assert.strictEqual(stats.count, 1);
  });
});

// ── getCostByProject ────────────────────────────────────────────────────────

describe("getCostByProject", () => {
  let db: ReturnType<typeof createTestDB>;

  beforeEach(() => {
    db = createTestDB();
    seedAgent(db);
    seedProject(db, "proj-1");
    seedTask(db, "task-1", "proj-1");
  });

  it("groups costs by project via leftJoin", () => {
    logUsage(db, {
      agentId: "agent-1",
      taskId: "task-1",
      model: "claude-sonnet-4-6",
      tokensIn: 1000,
      tokensOut: 500,
    });

    const result = getCostByProject(db);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].projectId, "proj-1");
    assert.ok(result[0].totalCost > 0);
    assert.ok(result[0].totalTokens > 0);
  });

  it("returns null projectId for logs without a task", () => {
    logUsage(db, {
      agentId: "agent-1",
      model: "claude-sonnet-4-6",
      tokensIn: 500,
      tokensOut: 200,
    });

    const result = getCostByProject(db);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].projectId, null);
  });

  it("separates logs with and without projects", () => {
    // Log with project
    logUsage(db, {
      agentId: "agent-1",
      taskId: "task-1",
      model: "claude-sonnet-4-6",
      tokensIn: 1000,
      tokensOut: 500,
    });
    // Log without task (null project)
    logUsage(db, {
      agentId: "agent-1",
      model: "claude-sonnet-4-6",
      tokensIn: 500,
      tokensOut: 200,
    });

    const result = getCostByProject(db);
    assert.strictEqual(result.length, 2);

    const projectIds = result.map((r) => r.projectId);
    assert.ok(projectIds.includes("proj-1"));
    assert.ok(projectIds.includes(null));
  });
});

// ── getDailySpend ───────────────────────────────────────────────────────────

describe("getDailySpend", () => {
  let db: ReturnType<typeof createTestDB>;

  beforeEach(() => {
    db = createTestDB();
    seedAgent(db);
  });

  it("fills in zero-valued entries for days with no data", () => {
    const from = new Date("2025-01-01T00:00:00Z");
    const to = new Date("2025-01-05T00:00:00Z");

    const result = getDailySpend(db, from, to);

    // Should have 5 days: Jan 1-5
    assert.strictEqual(result.length, 5);
    for (const day of result) {
      assert.strictEqual(day.cost, 0);
      assert.strictEqual(day.tokensIn, 0);
      assert.strictEqual(day.tokensOut, 0);
    }

    assert.strictEqual(result[0].date, "2025-01-01");
    assert.strictEqual(result[4].date, "2025-01-05");
  });

  it("returns data for days with usage and zeros for gaps", () => {
    // Insert a log with a specific timestamp (Jan 3, 2025)
    const jan3Epoch = Math.floor(
      new Date("2025-01-03T12:00:00Z").getTime() / 1000,
    );
    // Insert directly via the underlying sqlite to control created_at
    const sqlite = (db as unknown as { session: { client: Database.Database } })
      .session.client;
    sqlite.exec(`
      INSERT INTO usage_logs (id, agent_id, model, tokens_in, tokens_out, cost, created_at)
      VALUES ('log-1', 'agent-1', 'claude-sonnet-4-6', 1000, 500, 0.5, ${jan3Epoch})
    `);

    const from = new Date("2025-01-01T00:00:00Z");
    const to = new Date("2025-01-05T00:00:00Z");
    const result = getDailySpend(db, from, to);

    assert.strictEqual(result.length, 5);

    // Jan 1, 2, 4, 5 should be zero
    assert.strictEqual(result[0].cost, 0);
    assert.strictEqual(result[1].cost, 0);
    assert.strictEqual(result[3].cost, 0);
    assert.strictEqual(result[4].cost, 0);

    // Jan 3 should have data
    assert.strictEqual(result[2].date, "2025-01-03");
    assert.strictEqual(result[2].cost, 0.5);
    assert.strictEqual(result[2].tokensIn, 1000);
    assert.strictEqual(result[2].tokensOut, 500);
  });

  it("returns a single entry when from equals to", () => {
    const date = new Date("2025-03-15T00:00:00Z");
    const result = getDailySpend(db, date, date);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].date, "2025-03-15");
    assert.strictEqual(result[0].cost, 0);
  });
});
