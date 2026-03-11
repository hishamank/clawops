import { describe, it, mock } from "node:test";
import assert from "node:assert";
import type { DB, SyncRun, SyncRunItem } from "@clawops/core";

const BASE_RUN: SyncRun = {
  id: "run-1",
  connectionId: null,
  syncType: "manual",
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
  meta: '{"source":"api"}',
};

const BASE_ITEM: SyncRunItem = {
  id: "item-1",
  syncRunId: "run-1",
  itemType: "agent",
  itemExternalId: "agent-1",
  changeType: "seen",
  summary: "Discovered agent",
  meta: '{"workspacePath":"/tmp/workspace"}',
  createdAt: new Date("2026-03-11T00:00:01.000Z"),
};

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
  values: () => InsertChain;
  run: () => void;
  returning: () => InsertChain;
  all: () => SyncRun[];
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
  onInsertItems?: () => void;
  onUpdateRun?: (value: Record<string, unknown>) => void;
}): DB {
  const runs = options?.runs ?? [BASE_RUN];
  const items = options?.items ?? [BASE_ITEM];
  const updatedRuns = options?.updatedRuns ?? [
    {
      ...BASE_RUN,
      status: "success",
      completedAt: new Date("2026-03-11T00:01:00.000Z"),
      agentCount: 1,
      updatedCount: 2,
      meta: '{"source":"api","gatewayUrl":"http://localhost:3000"}',
    },
  ];
  const insertedRuns = options?.insertedRuns ?? [BASE_RUN];

  let selectCall = 0;
  const updateChain: UpdateChain = {
    set: (value) => {
      options?.onUpdateRun?.(value);
      return updateChain;
    },
    where: () => updateChain,
    returning: () => updateChain,
    all: () => updatedRuns,
  };
  const insertChain: InsertChain = {
    values: () => {
      options?.onInsertItems?.();
      return insertChain;
    },
    run: () => undefined,
    returning: () => insertChain,
    all: () => insertedRuns,
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
  },
});

const { startSyncRun, finishSyncRun, getSyncRun, listSyncRuns } = await import("./runs.js");

describe("startSyncRun", () => {
  it("creates and returns a running sync run", () => {
    const result = startSyncRun(makeDb(), {
      syncType: "manual",
      meta: { source: "api" },
    });

    assert.equal(result.id, "run-1");
    assert.equal(result.status, "running");
  });
});

describe("finishSyncRun", () => {
  it("wraps updates in a transaction and returns the completed summary", () => {
    let transactionCount = 0;
    let insertItemCount = 0;
    let updatedConnectionId: string | null | undefined;
    const result = finishSyncRun(
      makeDb({
        onTransaction: () => {
          transactionCount += 1;
        },
        onInsertItems: () => {
          insertItemCount += 1;
        },
        onUpdateRun: (value) => {
          updatedConnectionId = (value["connectionId"] as string | null | undefined) ?? undefined;
        },
      }),
      "run-1",
      {
        connectionId: "conn-1",
        status: "success",
        items: [
          {
            itemType: "agent",
            itemExternalId: "agent-1",
            changeType: "seen",
          },
        ],
      },
    );

    assert.equal(transactionCount, 1);
    assert.equal(insertItemCount, 1);
    assert.equal(updatedConnectionId, "conn-1");
    assert.equal(result.status, "success");
    assert.equal(result.items.length, 1);
    assert.equal(result.metaObject["gatewayUrl"], "http://localhost:3000");
  });
});

describe("getSyncRun", () => {
  it("returns a run summary with parsed metadata", () => {
    const result = getSyncRun(makeDb(), "run-1");

    assert.ok(result);
    assert.equal(result?.id, "run-1");
    assert.equal(result?.items[0]?.metaObject["workspacePath"], "/tmp/workspace");
  });
});

describe("listSyncRuns", () => {
  it("builds summaries without re-querying each run individually", () => {
    const runs = [
      BASE_RUN,
      {
        ...BASE_RUN,
        id: "run-2",
        meta: '{"source":"cron"}',
      },
    ];
    const items = [
      BASE_ITEM,
      {
        ...BASE_ITEM,
        id: "item-2",
        syncRunId: "run-2",
        meta: '{"workspacePath":"/tmp/workspace-2"}',
      },
    ];

    const result = listSyncRuns(
      makeDb({
        runs,
        items,
      }),
      10,
    );

    assert.equal(result.length, 2);
    assert.equal(result[0]?.items.length, 1);
    assert.equal(result[1]?.items[0]?.syncRunId, "run-2");
  });
});
