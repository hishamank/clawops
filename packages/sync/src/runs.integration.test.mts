import { before, describe, it } from "node:test";
import assert from "node:assert";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { DB } from "@clawops/core";
import * as schema from "@clawops/core";

const { startSyncRun, finishSyncRun, getSyncRun, listSyncRuns } = await import("./runs.js");

let db: DB;

before(() => {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE sync_runs (
      id text PRIMARY KEY NOT NULL,
      connection_id text,
      sync_type text DEFAULT 'manual' NOT NULL,
      status text DEFAULT 'running' NOT NULL,
      started_at integer DEFAULT (unixepoch()) NOT NULL,
      completed_at integer,
      agent_count integer DEFAULT 0 NOT NULL,
      cron_job_count integer DEFAULT 0 NOT NULL,
      workspace_count integer DEFAULT 0 NOT NULL,
      added_count integer DEFAULT 0 NOT NULL,
      updated_count integer DEFAULT 0 NOT NULL,
      removed_count integer DEFAULT 0 NOT NULL,
      error text,
      meta text
    );

    CREATE TABLE sync_run_items (
      id text PRIMARY KEY NOT NULL,
      sync_run_id text NOT NULL,
      item_type text NOT NULL,
      item_external_id text NOT NULL,
      change_type text NOT NULL,
      summary text,
      meta text,
      created_at integer DEFAULT (unixepoch()) NOT NULL,
      FOREIGN KEY (sync_run_id) REFERENCES sync_runs(id) ON UPDATE no action ON DELETE no action
    );
  `);
  db = drizzle(sqlite, { schema }) as unknown as DB;
});

describe("sync runs (integration)", () => {
  it("creates a durable sync run with running status", () => {
    const run = startSyncRun(db, {
      syncType: "manual",
      meta: { source: "route" },
    });

    assert.ok(run.id);
    assert.equal(run.status, "running");
    assert.equal(run.syncType, "manual");
    assert.ok(run.startedAt);
  });

  it("finalizes a sync run and stores item details", () => {
    const started = startSyncRun(db, {
      syncType: "reconcile",
      meta: { source: "test" },
    });

    const finished = finishSyncRun(db, started.id, {
      status: "success",
      agentCount: 2,
      cronJobCount: 1,
      workspaceCount: 2,
      updatedCount: 5,
      meta: { gatewayUrl: "http://localhost:3000" },
      items: [
        {
          itemType: "agent",
          itemExternalId: "main",
          changeType: "seen",
          summary: "Discovered agent main",
        },
        {
          itemType: "workspace",
          itemExternalId: "/tmp/workspace",
          changeType: "seen",
          summary: "Scanned workspace",
          meta: { hasFiles: true },
        },
      ],
    });

    assert.equal(finished.status, "success");
    assert.equal(finished.agentCount, 2);
    assert.equal(finished.items.length, 2);
    assert.equal(finished.metaObject["gatewayUrl"], "http://localhost:3000");
    assert.equal(finished.items[1]?.metaObject["hasFiles"], true);
  });

  it("retrieves recent sync runs in reverse chronological order", () => {
    const failed = startSyncRun(db, { syncType: "scheduled" });
    finishSyncRun(db, failed.id, {
      status: "failed",
      error: "Gateway unavailable",
      meta: { phase: "cron-fetch" },
    });

    const runs = listSyncRuns(db, 10);
    const failedRun = runs.find((run) => run.id === failed.id);

    assert.ok(runs.length >= 2);
    assert.ok(failedRun);
    assert.equal(failedRun.status, "failed");
    assert.equal(failedRun.error, "Gateway unavailable");
  });

  it("returns a single sync run with parsed metadata", () => {
    const run = listSyncRuns(db, 1)[0];
    assert.ok(run);

    const fetched = getSyncRun(db, run.id);
    assert.ok(fetched);
    assert.deepEqual(fetched.metaObject, run.metaObject);
  });
});
