import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { DB } from "@clawops/core";
import * as schema from "@clawops/core";
import { initAgent } from "@clawops/agents";

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

const {
  getUsageCursor,
  listImportedUsageEntries,
  syncSessionUsage,
} = await import("./usage.js");

let db: DB;
let rootPath: string;
let connectionId: string;

beforeEach(() => {
  if (!supportsBetterSqlite) {
    return;
  }

  rootPath = fs.mkdtempSync(path.join(os.tmpdir(), "clawops-usage-sync-"));
  fs.mkdirSync(path.join(rootPath, "agents", "jax", "sessions"), { recursive: true });
  fs.writeFileSync(
    path.join(rootPath, "openclaw.json"),
    JSON.stringify({
      agents: {
        defaults: {
          models: {
            "openrouter/google/gemini-2.5-flash": {
              alias: "flash",
            },
          },
        },
      },
    }),
  );

  const sqlite = new Database(":memory:");
  db = drizzle(sqlite, { schema }) as DB;
  migrate(db, {
    migrationsFolder: path.resolve(__dirname, "../../../core/migrations"),
  });

  const connection = db
    .insert(schema.openclawConnections)
    .values({
      name: "Local OpenClaw",
      rootPath,
      gatewayUrl: "http://localhost:3000",
      status: "active",
      syncMode: "hybrid",
      hasGatewayToken: false,
      updatedAt: new Date("2026-03-19T10:00:00.000Z"),
    })
    .returning()
    .get();
  connectionId = connection.id;

  initAgent(db, {
    name: "Jax",
    model: "openrouter/google/gemini-2.5-flash",
    role: "builder",
    framework: "openclaw",
    memoryPath: path.join(rootPath, "workspace"),
    openclaw: {
      connectionId,
      externalAgentId: "jax",
      externalAgentName: "Jax",
      workspacePath: path.join(rootPath, "workspace"),
      memoryPath: path.join(rootPath, "workspace"),
      defaultModel: "openrouter/google/gemini-2.5-flash",
      role: "builder",
    },
  });

  db.insert(schema.openclawSessions)
    .values({
      connectionId,
      sessionKey: "session-1",
      agentId: "jax",
      model: "openrouter/google/gemini-2.5-flash",
      status: "active",
      startedAt: new Date("2026-03-19T09:00:00.000Z"),
    })
    .run();
});

describe("syncSessionUsage", () => {
  integrationTest("backfills session usage, resumes incrementally, and dedupes rewritten files", () => {
    const sessionFile = path.join(rootPath, "agents", "jax", "sessions", "session-1.jsonl");

    const lineOne = JSON.stringify({
      type: "message",
      timestamp: "2026-03-19T09:15:00Z",
      message: {
        provider: "openrouter",
        model: "openrouter/google/gemini-2.5-flash",
        usage: {
          input: 100,
          output: 40,
          cost: { total: 0.12 },
        },
      },
    });
    const lineTwo = JSON.stringify({
      type: "message",
      timestamp: "2026-03-19T09:45:00Z",
      message: {
        provider: "anthropic",
        model: "anthropic/claude-sonnet-4-6",
        usage: {
          totalTokens: 90,
          cost: { total: 0.08 },
        },
      },
    });
    const ignoredLine = JSON.stringify({
      type: "message",
      timestamp: "2026-03-19T09:55:00Z",
      message: {
        provider: "openclaw",
        model: "delivery-mirror",
        usage: {
          input: 999,
        },
      },
    });
    fs.writeFileSync(sessionFile, [lineOne, lineTwo, ignoredLine].join("\n"));

    const connection = db
      .select()
      .from(schema.openclawConnections)
      .where(schema.eq(schema.openclawConnections.id, connectionId))
      .get();
    assert.ok(connection);

    const firstSync = syncSessionUsage(db, connection);
    assert.equal(firstSync.scannedFileCount, 1);
    assert.equal(firstSync.importedCount, 2);
    assert.equal(firstSync.rescannedFileCount, 0);

    const firstEntries = listImportedUsageEntries(db, connectionId);
    assert.equal(firstEntries.length, 2);
    assert.equal(firstEntries[0]?.modelAlias, "flash");
    assert.ok(firstEntries.every((entry) => entry.sessionId !== null));

    const cursorAfterFirstSync = getUsageCursor(db, connectionId, path.relative(rootPath, sessionFile));
    assert.ok(cursorAfterFirstSync);

    const lineThree = JSON.stringify({
      type: "message",
      timestamp: "2026-03-19T10:15:00Z",
      message: {
        provider: "nvidia",
        model: "nvidia/moonshotai/kimi-k2.5",
        usage: {
          input: 30,
          output: 20,
          cacheRead: 5,
          cacheWrite: 5,
          cost: { total: 0.03 },
        },
      },
    });
    fs.appendFileSync(sessionFile, `\n${lineThree}`);

    const secondSync = syncSessionUsage(db, connection);
    assert.equal(secondSync.importedCount, 1);
    assert.equal(secondSync.rescannedFileCount, 0);
    assert.equal(listImportedUsageEntries(db, connectionId).length, 3);

    fs.writeFileSync(sessionFile, [lineOne, lineTwo].join("\n"));

    const thirdSync = syncSessionUsage(db, connection);
    assert.equal(thirdSync.importedCount, 0);
    assert.equal(thirdSync.rescannedFileCount, 1);
    assert.equal(listImportedUsageEntries(db, connectionId).length, 3);
  });
});
