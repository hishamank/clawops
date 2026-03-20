import { describe, it, mock } from "node:test";
import assert from "node:assert";
import type {
  DB,
  SyncRun,
  SyncRunItem,
  OpenClawConnection,
  Habit,
  OpenClawSession,
} from "@clawops/core";

const BASE_CONNECTION: OpenClawConnection = {
  id: "conn-1",
  provider: "openclaw",
  name: "OpenClaw Test",
  rootPath: "~/.openclaw",
  gatewayUrl: "http://localhost:3000",
  status: "active",
  syncMode: "hybrid",
  hasGatewayToken: true,
  meta: null,
  lastSyncedAt: null,
  createdAt: new Date("2026-03-11T00:00:00.000Z"),
  updatedAt: new Date("2026-03-11T00:00:00.000Z"),
};

const BASE_RUN: SyncRun = {
  id: "run-1",
  connectionId: "conn-1",
  syncType: "reconcile",
  status: "running",
  startedAt: new Date("2026-03-11T00:00:00.000Z"),
  completedAt: null,
  agentCount: 0,
  cronJobCount: 0,
  workspaceCount: 0,
  addedCount: 0,
  updatedCount: 0,
  removedCount: 0,
  error: null,
  meta: null,
};

const BASE_ITEM: SyncRunItem = {
  id: "item-1",
  syncRunId: "run-1",
  itemType: "agent",
  itemExternalId: "session-1",
  changeType: "seen",
  summary: "Session active",
  meta: null,
  createdAt: new Date("2026-03-11T00:00:01.000Z"),
};

const syncSessionsTokens: Array<string | undefined> = [];
const syncCronJobTokens: string[] = [];

interface SelectChain<T> {
  from: () => SelectChain<T>;
  where: () => SelectChain<T>;
  orderBy: () => SelectChain<T>;
  limit: () => SelectChain<T>;
  all: () => T[];
}

interface UpdateChain {
  set: (value: Record<string, unknown>) => UpdateChain;
  where: () => UpdateChain;
  returning: () => UpdateChain;
  all: () => SyncRun[];
}

interface InsertChain {
  values: (values?: unknown[]) => InsertChain;
  run: () => void;
  returning: () => InsertChain;
  all: () => SyncRun[];
  get: () => SyncRun | undefined;
}

function makeSelectChain<T>(rows: T[]): SelectChain<T> {
  const chain: SelectChain<T> = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    all: () => rows,
  };
  return chain;
}

function makeDb(options?: {
  runs?: SyncRun[];
  items?: SyncRunItem[];
  updatedRuns?: SyncRun[];
  insertedRuns?: SyncRun[];
  onTransaction?: () => void;
  onInsertItems?: (values?: unknown[]) => void;
  onUpdateRun?: (value: Record<string, unknown>) => void;
}): DB {
  const runs = options?.runs ?? [BASE_RUN];
  const items = options?.items ?? [BASE_ITEM];
  const insertedRuns = options?.insertedRuns ?? [BASE_RUN];

  let selectCall = 0;
  let lastUpdateValue: Record<string, unknown> = {};
  const updateChain: UpdateChain = {
    set: (value) => {
      lastUpdateValue = value;
      options?.onUpdateRun?.(value);
      return updateChain;
    },
    where: () => updateChain,
    returning: () => updateChain,
    all: () => {
      // Return a run with the values that were set
      return [{
        ...BASE_RUN,
        status: "success",
        completedAt: new Date("2026-03-11T00:01:00.000Z"),
        agentCount: Number(lastUpdateValue.agentCount ?? 0),
        cronJobCount: Number(lastUpdateValue.cronJobCount ?? 0),
        workspaceCount: Number(lastUpdateValue.workspaceCount ?? 0),
        addedCount: Number(lastUpdateValue.addedCount ?? 0),
        updatedCount: Number(lastUpdateValue.updatedCount ?? 0),
        meta: lastUpdateValue.meta as string ?? '{"mode":"full","gatewayUrl":"http://localhost:3000"}',
      }];
    },
  };
  const insertChain: InsertChain = {
    values: (values?: unknown[]) => {
      options?.onInsertItems?.(values);
      return insertChain;
    },
    run: () => undefined,
    returning: () => insertChain,
    all: () => insertedRuns,
    get: () => insertedRuns[0],
  };

  const db = {
    select: () => {
      selectCall += 1;
      return makeSelectChain(selectCall === 1 ? runs : items);
    },
    insert: () => insertChain,
    update: () => updateChain,
    transaction: <T>(cb: (tx: DB) => T): T => {
      options?.onTransaction?.();
      return cb(db as unknown as DB);
    },
  };

  return db as unknown as DB;
}

mock.module("@clawops/core", {
  namedExports: {
    syncRuns: Symbol("syncRuns"),
    syncRunItems: Symbol("syncRunItems"),
    eq: () => ({}),
    or: () => ({}),
    desc: () => ({}),
    parseJsonObject: (value: string | null) => (value ? JSON.parse(value) : {}),
    toJsonObject: (value: Record<string, unknown>) => JSON.stringify(value),
    createActivityEvent: () => ({}),
  },
});

mock.module("./openclaw/sessions.js", {
  namedExports: {
    syncSessions: (_db: DB, _connection: OpenClawConnection, token?: string) => {
      syncSessionsTokens.push(token);
      return Promise.resolve([
        {
          id: "session-1",
          connectionId: "conn-1",
          sessionKey: "session-1",
          agentId: "agent-1",
          model: "gpt-4",
          status: "active",
          startedAt: new Date("2026-03-11T00:00:00.000Z"),
          endedAt: null,
          metadata: null,
          createdAt: new Date("2026-03-11T00:00:00.000Z"),
          updatedAt: new Date("2026-03-11T00:00:00.000Z"),
        },
      ] as OpenClawSession[]);
    },
    syncAgentStatusFromSessions: () => ({ updatedOnline: 0, updatedIdle: 0 }),
  },
});

mock.module("@clawops/habits", {
  namedExports: {
    syncCronJobs: (_db: DB, _connection: OpenClawConnection, token: string) => {
      syncCronJobTokens.push(token);
      return Promise.resolve([
        {
          id: "habit-1",
          connectionId: "conn-1",
          agentId: "agent-1",
          externalId: "cron-1",
          name: "Test Cron",
          type: "cron",
          schedule: '{"kind":"cron","expr":"0 * * * *"}',
          cronExpr: "0 * * * *",
          scheduleKind: "cron",
          scheduleExpr: "0 * * * *",
          sessionTarget: "main",
          trigger: "main",
          status: "active",
          enabled: true,
          lastRun: null,
          nextRun: null,
          lastSyncedAt: new Date("2026-03-11T00:00:00.000Z"),
          createdAt: new Date("2026-03-11T00:00:00.000Z"),
        },
      ] as Habit[]);
    },
  },
});

mock.module("./openclaw/files.js", {
  namedExports: {
    syncWorkspaceFiles: () =>
      Promise.resolve({
        fetchedCount: 1,
        inserted: [
          {
            id: "file-1",
            connectionId: "conn-1",
            workspacePath: "~/.openclaw/workspace",
            relativePath: "SOUL.md",
            fileHash: "abc123",
            sizeBytes: 1024,
            lastSeenAt: new Date("2026-03-11T00:00:00.000Z"),
            createdAt: new Date("2026-03-11T00:00:00.000Z"),
            updatedAt: new Date("2026-03-11T00:00:00.000Z"),
          },
        ],
        updated: [],
        unchangedCount: 0,
      }),
  },
});

mock.module("./openclaw/usage.js", {
  namedExports: {
    syncSessionUsage: () => ({
      scannedFileCount: 1,
      rescannedFileCount: 0,
      importedCount: 2,
      skippedLineCount: 0,
      processedFiles: [
        {
          sessionFilePath: "agents/agent-1/sessions/session-1.jsonl",
          externalAgentId: "agent-1",
          importedCount: 2,
          scannedLineCount: 2,
          skippedLineCount: 0,
          rescanned: false,
        },
      ],
    }),
  },
});

mock.module("./connections.js", {
  namedExports: {
    getOpenClawConnection: (db: DB, connectionId: string) => {
      if (connectionId === "nonexistent") {
        return null;
      }
      return BASE_CONNECTION;
    },
  },
});

const { reconcile, reconcileConnection } = await import("./reconcile.js");

describe("reconcile", () => {
  it("uses the stored connection gateway token for full reconcile when no override is provided", async () => {
    syncCronJobTokens.length = 0;
    delete process.env["OPENCLAW_GATEWAY_TOKEN"];

    await reconcile(
      makeDb(),
      {
        ...BASE_CONNECTION,
        meta: JSON.stringify({ gatewayToken: "stored-gateway-token" }),
      },
      { mode: "full" },
    );

    assert.deepEqual(syncCronJobTokens, ["stored-gateway-token"]);
  });

  it("runs a full reconciliation and returns the result", async () => {
    let transactionCount = 0;
    let insertItemCount = 0;

    const result = await reconcile(
      makeDb({
        onTransaction: () => {
          transactionCount += 1;
        },
        onInsertItems: () => {
          insertItemCount += 1;
        },
      }),
      BASE_CONNECTION,
      {
        mode: "full",
        gatewayToken: "test-token",
      },
    );

    assert.equal(transactionCount, 1);
    assert.ok(insertItemCount >= 1);
    assert.equal(result.connection.id, "conn-1");
    assert.equal(result.agentCount, 1);
    assert.equal(result.cronJobCount, 1);
    assert.equal(result.workspaceCount, 1);
  });

  it("runs a sessions-only reconciliation", async () => {
    const result = await reconcile(makeDb(), BASE_CONNECTION, {
      mode: "sessions",
      gatewayToken: "test-token",
    });

    assert.equal(result.agentCount, 1);
    assert.equal(result.cronJobCount, 0);
    assert.equal(result.workspaceCount, 0);
  });

  it("runs a cron-only reconciliation", async () => {
    const result = await reconcile(makeDb(), BASE_CONNECTION, {
      mode: "cron",
      gatewayToken: "test-token",
    });

    assert.equal(result.agentCount, 0);
    assert.equal(result.cronJobCount, 1);
    assert.equal(result.workspaceCount, 0);
  });

  it("runs a files-only reconciliation", async () => {
    const result = await reconcile(makeDb(), BASE_CONNECTION, {
      mode: "files",
    });

    assert.equal(result.agentCount, 0);
    assert.equal(result.cronJobCount, 0);
    assert.equal(result.workspaceCount, 1);
  });

  it("runs a usage-only reconciliation", async () => {
    const result = await reconcile(makeDb(), BASE_CONNECTION, {
      mode: "usage",
    });

    assert.equal(result.agentCount, 0);
    assert.equal(result.cronJobCount, 0);
    assert.equal(result.workspaceCount, 0);
    assert.equal(result.addedCount, 2);
  });

  it("defaults to full reconciliation mode when not specified", async () => {
    const result = await reconcile(makeDb(), BASE_CONNECTION, {
      gatewayToken: "test-token",
    });

    assert.equal(result.agentCount, 1);
    assert.equal(result.cronJobCount, 1);
    assert.equal(result.workspaceCount, 1);
  });
});

describe("reconcileConnection", () => {
  it("fetches the connection and runs reconciliation", async () => {
    const result = await reconcileConnection(makeDb(), "conn-1", {
      mode: "full",
      gatewayToken: "test-token",
    });

    assert.equal(result.connection.id, "conn-1");
    assert.equal(result.connection.name, "OpenClaw Test");
  });

  it("throws an error when connection is not found", async () => {
    await assert.rejects(
      async () => reconcileConnection(makeDb(), "nonexistent"),
      (err: Error) => {
        assert.equal(err.message, 'OpenClaw connection "nonexistent" not found');
        return true;
      },
    );
  });
});
