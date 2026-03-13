import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

type Condition =
  | { kind: "eq"; column: string; value: unknown }
  | { kind: "and"; conditions: Condition[] };

interface ConnectionRow {
  id: string;
  provider: "openclaw";
  name: string;
  rootPath: string;
  gatewayUrl: string | null;
  status: "active" | "disconnected" | "error";
  syncMode: "manual" | "hybrid";
  hasGatewayToken: boolean;
  meta: string | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface WorkspaceFileRow {
  id: string;
  connectionId: string;
  workspacePath: string;
  relativePath: string;
  fileHash: string | null;
  sizeBytes: number | null;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface EventRow {
  agentId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  meta: string | null;
  createdAt: Date;
}

interface ActivityEventRow {
  source: "agent" | "system" | "human";
  severity: "info" | "warning" | "error";
  type: string;
  title: string;
  body: string | null;
  entityType: string;
  entityId: string;
  agentId: string | null;
  metadata: string | null;
}

interface RevisionRow {
  workspaceFileId: string;
  hash: string | null;
  sizeBytes: number | null;
  gitCommitSha: string | null;
  gitBranch: string | null;
  source: string;
  capturedAt: Date;
}

interface HabitRow {
  id: string;
  name: string;
  enabled: boolean;
  externalId: string | null;
}

const OPENCLAW_CONNECTIONS = Symbol("openclawConnections");
const WORKSPACE_FILES = Symbol("workspaceFiles");
const WORKSPACE_FILE_REVISIONS = Symbol("workspaceFileRevisions");
const EVENTS = Symbol("events");

let shouldFailCronUpdate = false;
let tempDir = "";

mock.module("@clawops/core", {
  namedExports: {
    and: (...conditions: Condition[]): Condition => ({ kind: "and", conditions }),
    createActivityEvent: (db: FakeDb, event: ActivityEventRow) => {
      db.activityEvents.push(event);
      return event;
    },
    eq: (column: string, value: unknown): Condition => ({ kind: "eq", column, value }),
    events: { __table: EVENTS },
    openclawConnections: {
      id: "id",
      __table: OPENCLAW_CONNECTIONS,
    },
    workspaceFiles: {
      id: "id",
      connectionId: "connectionId",
      relativePath: "relativePath",
      __table: WORKSPACE_FILES,
    },
    workspaceFileRevisions: {
      workspaceFileId: "workspaceFileId",
      __table: WORKSPACE_FILE_REVISIONS,
    },
  },
});

mock.module("@clawops/habits", {
  namedExports: {
    getCronJob: (_db: FakeDb, cronJobId: string): HabitRow | null =>
      cronJobId === "cron-1"
        ? {
            id: "cron-1",
            name: "Nightly sync",
            enabled: true,
            externalId: "remote-cron-1",
          }
        : null,
    updateConnectionCronJob: async (
      _db: FakeDb,
      cronJobId: string,
      patch: Record<string, unknown>,
    ) => {
      if (shouldFailCronUpdate) {
        throw new Error(`gateway update failed for ${cronJobId}`);
      }

      return {
        local: {
          id: cronJobId,
          name: (patch["name"] as string | undefined) ?? "Nightly sync",
          enabled: (patch["enabled"] as boolean | undefined) ?? true,
          externalId: "remote-cron-1",
        },
        remote: null,
      };
    },
  },
});

const {
  triggerSupportedOpenClawEndpoint,
  updateOpenClawCronAction,
  writeTrackedOpenClawFile,
} = await import("./actions.js");

function matchesCondition(
  row: Record<string, unknown>,
  condition: Condition | null,
): boolean {
  if (!condition) {
    return true;
  }

  if (condition.kind === "eq") {
    return row[condition.column] === condition.value;
  }

  return condition.conditions.every((entry) => matchesCondition(row, entry));
}

class FakeDb {
  connections: ConnectionRow[];
  workspaceFilesRows: WorkspaceFileRow[];
  workspaceFileRevisionsRows: RevisionRow[];
  eventRows: EventRow[];
  activityEvents: ActivityEventRow[];

  constructor(seed?: { connections?: ConnectionRow[]; workspaceFiles?: WorkspaceFileRow[] }) {
    this.connections = [...(seed?.connections ?? [])];
    this.workspaceFilesRows = [...(seed?.workspaceFiles ?? [])];
    this.workspaceFileRevisionsRows = [];
    this.eventRows = [];
    this.activityEvents = [];
  }

  select() {
    return {
      from: (table: { __table: symbol }) => ({
        where: (condition: Condition) => ({
          get: () => {
            if (table.__table === OPENCLAW_CONNECTIONS) {
              return this.connections.find((row) => matchesCondition(row, condition)) ?? null;
            }

            if (table.__table === WORKSPACE_FILES) {
              return this.workspaceFilesRows.find((row) => matchesCondition(row, condition)) ?? null;
            }

            return null;
          },
        }),
      }),
    };
  }

  insert(table: { __table: symbol }) {
    return {
      values: (values: Record<string, unknown>) => ({
        run: () => {
          if (table.__table === EVENTS) {
            this.eventRows.push(values as unknown as EventRow);
            return;
          }

          if (table.__table === WORKSPACE_FILE_REVISIONS) {
            this.workspaceFileRevisionsRows.push(values as unknown as RevisionRow);
          }
        },
        returning: () => ({
          get: () => {
            if (table.__table !== WORKSPACE_FILES) {
              return null;
            }

            const inserted: WorkspaceFileRow = {
              id: `wf-${this.workspaceFilesRows.length + 1}`,
              connectionId: String(values["connectionId"]),
              workspacePath: String(values["workspacePath"]),
              relativePath: String(values["relativePath"]),
              fileHash: (values["fileHash"] as string | null | undefined) ?? null,
              sizeBytes: (values["sizeBytes"] as number | null | undefined) ?? null,
              lastSeenAt: values["lastSeenAt"] as Date,
              createdAt: values["createdAt"] as Date,
              updatedAt: values["updatedAt"] as Date,
            };
            this.workspaceFilesRows.push(inserted);
            return inserted;
          },
        }),
      }),
    };
  }

  update(table: { __table: symbol }) {
    return {
      set: (values: Record<string, unknown>) => ({
        where: (condition: Condition) => ({
          returning: () => ({
            get: () => {
              if (table.__table !== WORKSPACE_FILES) {
                return null;
              }

              const row = this.workspaceFilesRows.find((entry) => matchesCondition(entry, condition));
              if (!row) {
                return null;
              }

              Object.assign(row, values);
              return row;
            },
          }),
        }),
      }),
    };
  }

  transaction<T>(callback: (tx: FakeDb) => T): T {
    return callback(this);
  }
}

function makeConnection(): ConnectionRow {
  return {
    id: "conn-1",
    provider: "openclaw",
    name: "OpenClaw Local",
    rootPath: tempDir,
    gatewayUrl: "https://gateway.example.test",
    status: "active",
    syncMode: "hybrid",
    hasGatewayToken: true,
    meta: null,
    lastSyncedAt: null,
    createdAt: new Date("2026-03-13T00:00:00.000Z"),
    updatedAt: new Date("2026-03-13T00:00:00.000Z"),
  };
}

beforeEach(() => {
  shouldFailCronUpdate = false;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawops-openclaw-actions-"));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("updateOpenClawCronAction", () => {
  it("audits successful cron mutations", async () => {
    const db = new FakeDb();
    const result = await updateOpenClawCronAction(db as never, {
      actorAgentId: "agent-1",
      source: "cli",
      cronJobId: "cron-1",
      patch: { enabled: false },
      gatewayToken: "token",
    });

    assert.equal(result.local.enabled, false);
    assert.equal(db.eventRows.length, 1);
    assert.equal(db.eventRows[0]?.action, "openclaw.action.cron_job.updated");
    assert.equal(db.activityEvents.length, 1);
    assert.equal(db.activityEvents[0]?.type, "openclaw.action.cron.updated");
  });

  it("audits failed cron mutations", async () => {
    shouldFailCronUpdate = true;
    const db = new FakeDb();

    await assert.rejects(
      updateOpenClawCronAction(db as never, {
        actorAgentId: "agent-1",
        source: "api",
        cronJobId: "cron-1",
        patch: { enabled: false },
        gatewayToken: "token",
      }),
      /gateway update failed/,
    );

    assert.equal(db.eventRows[0]?.action, "openclaw.action.cron_job.update_failed");
    assert.equal(db.activityEvents[0]?.severity, "error");
  });
});

describe("writeTrackedOpenClawFile", () => {
  it("writes a tracked file, updates metadata, and records revisions", () => {
    const workspacePath = path.join(tempDir, "workspace-main");
    const absolutePath = path.join(workspacePath, "notes/today.md");
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, "before", "utf8");

    const db = new FakeDb({
      connections: [makeConnection()],
      workspaceFiles: [
        {
          id: "wf-1",
          connectionId: "conn-1",
          workspacePath,
          relativePath: "notes/today.md",
          fileHash: "old-hash",
          sizeBytes: 6,
          lastSeenAt: new Date("2026-03-12T00:00:00.000Z"),
          createdAt: new Date("2026-03-12T00:00:00.000Z"),
          updatedAt: new Date("2026-03-12T00:00:00.000Z"),
        },
      ],
    });

    const updated = writeTrackedOpenClawFile(db as never, {
      actorAgentId: "agent-2",
      source: "api",
      connectionId: "conn-1",
      relativePath: "notes/today.md",
      content: "after",
    });

    assert.equal(updated.id, "wf-1");
    assert.equal(fs.readFileSync(absolutePath, "utf8"), "after");
    assert.equal(db.workspaceFileRevisionsRows.length, 1);
    assert.equal(db.workspaceFileRevisionsRows[0]?.source, "action");
    assert.equal(db.eventRows[0]?.action, "openclaw.action.file.written");
    assert.equal(db.activityEvents[0]?.type, "openclaw.action.file.written");
  });
});

describe("triggerSupportedOpenClawEndpoint", () => {
  it("surfaces remote failures cleanly and audits them", async (t) => {
    const db = new FakeDb({
      connections: [makeConnection()],
    });

    t.mock.method(globalThis, "fetch", async () =>
      new Response(JSON.stringify({ error: "bad gateway" }), {
        status: 502,
        headers: { "content-type": "application/json" },
      }));

    await assert.rejects(
      triggerSupportedOpenClawEndpoint(db as never, {
        actorAgentId: "agent-3",
        source: "api",
        connectionId: "conn-1",
        endpoint: "/api/actions/rebuild-index",
        body: { force: true },
        gatewayToken: "token",
      }),
      /status 502/,
    );

    assert.equal(db.eventRows[0]?.action, "openclaw.action.trigger.failed");
    assert.equal(db.activityEvents[0]?.type, "openclaw.action.trigger.failed");
    assert.equal(db.activityEvents[0]?.severity, "error");
  });
});
