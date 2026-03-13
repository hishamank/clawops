import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { DB } from "@clawops/core";
import * as schema from "@clawops/core";
import { initAgent } from "@clawops/agents";
import { upsertCronJobs } from "@clawops/habits";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const Database = await import("better-sqlite3")
  .then((module) => module.default)
  .catch(() => null);
const supportsBetterSqlite = (() => {
  if (!Database) return false;

  try {
    const sqlite = new Database(":memory:");
    sqlite.close();
    return true;
  } catch {
    return false;
  }
})();
const integrationTest = supportsBetterSqlite ? it : it.skip;

const { ingestOpenClawInboundEvent, normalizeOpenClawInboundEvent } = await import("./events.js");

let db: DB;
let connectionId = "conn-test";
let agentId = "agent-test";

beforeEach(() => {
  if (!supportsBetterSqlite) {
    return;
  }

  const sqlite = new Database(":memory:");
  db = drizzle(sqlite, { schema }) as DB;
  migrate(db, {
    migrationsFolder: path.resolve(__dirname, "../../core/migrations"),
  });

  const connection = db
    .insert(schema.openclawConnections)
    .values({
      name: "Local OpenClaw",
      rootPath: "/tmp/openclaw-events",
      gatewayUrl: "http://localhost:3000",
      status: "active",
      syncMode: "hybrid",
      hasGatewayToken: true,
      updatedAt: new Date("2026-03-13T00:00:00.000Z"),
    })
    .returning()
    .get();
  connectionId = connection.id;

  const registration = initAgent(db, {
    name: "Alpha",
    model: "gpt-5",
    role: "builder",
    framework: "openclaw",
    memoryPath: "/tmp/openclaw-events/workspace-alpha",
    openclaw: {
      connectionId,
      externalAgentId: "alpha-ext",
      externalAgentName: "Alpha",
      workspacePath: "/tmp/openclaw-events/workspace-alpha",
      memoryPath: "/tmp/openclaw-events/workspace-alpha",
      defaultModel: "gpt-5",
      role: "builder",
    },
  });
  agentId = registration.agent.id;

  upsertCronJobs(db, connectionId, [
    {
      id: "cron-1",
      name: "Nightly reconcile",
      enabled: true,
      scheduleKind: "cron",
      scheduleExpr: "0 1 * * *",
      scheduleRaw: "{\"cron\":\"0 1 * * *\"}",
      sessionTarget: "alpha-ext",
      lastRunAt: null,
      nextRunAt: null,
    },
  ]);
});

describe("normalizeOpenClawInboundEvent", () => {
  it("normalizes a session start payload with aliases", () => {
    const normalized = normalizeOpenClawInboundEvent({
      eventType: "session.started",
      connectionId,
      timestamp: "2026-03-13T10:00:00.000Z",
      agent: { id: "alpha-ext" },
      session: {
        id: "sess-1",
        model: "claude-opus",
        startedAt: "2026-03-13T09:59:00.000Z",
      },
    });

    assert.equal(normalized.type, "session.started");
    assert.equal(normalized.sessionKey, "sess-1");
    assert.equal(normalized.agentExternalId, "alpha-ext");
    assert.equal(normalized.sessionModel, "claude-opus");
  });

  it("rejects unsupported event types", () => {
    assert.throws(
      () =>
        normalizeOpenClawInboundEvent({
          type: "file.changed",
          connectionId,
        }),
      /Unsupported OpenClaw event type/,
    );
  });
});

describe("ingestOpenClawInboundEvent", () => {
  integrationTest("records heartbeat activity and updates the linked agent", () => {
    const result = ingestOpenClawInboundEvent(db, {
      type: "agent.heartbeat",
      connectionId,
      occurredAt: "2026-03-13T12:00:00.000Z",
      agent: {
        externalId: "alpha-ext",
      },
    });

    const agent = db
      .select()
      .from(schema.agents)
      .where(schema.eq(schema.agents.id, agentId))
      .get();
    const heartbeatRuns = db
      .select()
      .from(schema.habitRuns)
      .where(schema.eq(schema.habitRuns.agentId, agentId))
      .all();

    assert.equal(result.normalizedEvent.type, "agent.heartbeat");
    assert.equal(result.lowLevelEvent.action, "openclaw.agent.heartbeat");
    assert.equal(result.activityEvent.type, "openclaw.agent.heartbeat");
    assert.equal(agent?.status, "online");
    assert.equal(heartbeatRuns.length, 1);
  });

  integrationTest("upserts session state and writes an activity record", () => {
    const result = ingestOpenClawInboundEvent(db, {
      type: "session.started",
      connectionId,
      occurredAt: "2026-03-13T12:30:00.000Z",
      agent: {
        externalId: "alpha-ext",
      },
      session: {
        key: "sess-2",
        model: "claude-opus",
        startedAt: "2026-03-13T12:29:00.000Z",
      },
    });

    const session = db
      .select()
      .from(schema.openclawSessions)
      .where(schema.eq(schema.openclawSessions.sessionKey, "sess-2"))
      .get();

    assert.equal(result.activityEvent.type, "openclaw.session.started");
    assert.equal(session?.status, "active");
    assert.equal(session?.agentId, agentId);
  });

  integrationTest("records cron runs for synced cron jobs", () => {
    const result = ingestOpenClawInboundEvent(db, {
      type: "cron.run.completed",
      connectionId,
      occurredAt: "2026-03-13T13:00:00.000Z",
      cron: {
        externalId: "cron-1",
      },
      run: {
        success: false,
        note: "Gateway timed out",
      },
    });

    const cron = db
      .select()
      .from(schema.habits)
      .where(schema.eq(schema.habits.externalId, "cron-1"))
      .get();
    const runs = db
      .select()
      .from(schema.habitRuns)
      .where(schema.eq(schema.habitRuns.habitId, cron?.id ?? ""))
      .all();

    assert.equal(result.activityEvent.type, "openclaw.cron.run.completed");
    assert.equal(result.activityEvent.severity, "warning");
    assert.equal(runs.length, 1);
    assert.equal(runs[0]?.success, false);
    assert.equal(runs[0]?.note, "Gateway timed out");
  });

  integrationTest("rejects events for unknown connections", () => {
    assert.throws(
      () =>
        ingestOpenClawInboundEvent(db, {
          type: "agent.heartbeat",
          connectionId: "missing-connection",
          agent: {
            externalId: "alpha-ext",
          },
        }),
      /connection "missing-connection" not found/i,
    );
  });
});
