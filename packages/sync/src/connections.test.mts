import { describe, it, mock } from "node:test";
import assert from "node:assert";
import type { DB, OpenClawConnection } from "@clawops/core";

const FAKE_CONNECTION: OpenClawConnection = {
  id: "conn-1",
  provider: "openclaw",
  name: "Local OpenClaw",
  rootPath: "/tmp/.openclaw",
  gatewayUrl: "http://localhost:3000",
  status: "active",
  syncMode: "hybrid",
  hasGatewayToken: true,
  meta: '{"env":"dev"}',
  lastSyncedAt: null,
  createdAt: new Date("2026-03-10T00:00:00.000Z"),
  updatedAt: new Date("2026-03-10T00:00:00.000Z"),
};

type ConnectionPayload = Record<string, unknown>;

interface StubChain {
  all: () => OpenClawConnection[];
  get: () => OpenClawConnection | null;
  onConflictDoNothing: () => StubChain;
  returning: () => StubChain;
  where: () => StubChain;
  from: () => StubChain;
  values: (value: ConnectionPayload) => StubChain;
  set: (value: ConnectionPayload) => StubChain;
  orderBy: () => StubChain;
}

interface StubDb {
  insert: () => StubChain;
  select: () => StubChain;
  transaction: <T>(cb: (tx: DB) => T) => T;
  update: () => StubChain;
}

function makeChain(
  row: OpenClawConnection | null = FAKE_CONNECTION,
  rows: OpenClawConnection[] = [FAKE_CONNECTION],
): StubChain {
  const chain: StubChain = {
    all: () => rows,
    get: () => row,
    onConflictDoNothing: () => chain,
    returning: () => chain,
    where: () => chain,
    from: () => chain,
    values: () => chain,
    set: () => chain,
    orderBy: () => chain,
  };
  return chain;
}

function makeDb(
  row: OpenClawConnection | null = FAKE_CONNECTION,
  rows: OpenClawConnection[] = [FAKE_CONNECTION],
): DB {
  const chain = makeChain(row, rows);
  const db: StubDb = {
    insert: () => chain,
    select: () => chain,
    transaction: (cb) => cb(db as unknown as DB),
    update: () => chain,
  };
  return db as unknown as DB;
}

mock.module("@clawops/core", {
  namedExports: {
    openclawConnections: Symbol("openclawConnections"),
    eq: () => ({}),
    desc: () => ({}),
    toJsonObject: (value: Record<string, unknown>) => JSON.stringify(value),
  },
});

const {
  getOpenClawConnection,
  listOpenClawConnections,
  upsertOpenClawConnection,
  updateOpenClawConnection,
} = await import("./connections.js");

describe("listOpenClawConnections", () => {
  it("returns an array of connections", () => {
    const result = listOpenClawConnections(makeDb());
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 1);
  });
});

describe("getOpenClawConnection", () => {
  it("returns a connection when found", () => {
    const result = getOpenClawConnection(makeDb(), "conn-1");
    assert.ok(result);
    assert.equal(result?.id, "conn-1");
  });

  it("returns null when not found", () => {
    const result = getOpenClawConnection(makeDb(null, []), "missing");
    assert.equal(result, null);
  });
});

describe("upsertOpenClawConnection", () => {
  it("creates a new connection when none exists", () => {
    let capturedValues: ConnectionPayload | undefined;
    const insertRow = { ...FAKE_CONNECTION, name: "Created OpenClaw" };
    const selectChain = makeChain(null, []);
    const insertChain: StubChain = {
      ...makeChain(insertRow, [insertRow]),
      returning: () => insertChain,
      values: (value) => {
        capturedValues = value;
        return insertChain;
      },
    };
    const db = {
      select: () => selectChain,
      insert: () => insertChain,
      transaction: (cb: (tx: DB) => unknown) => cb(db as unknown as DB),
      update: () => insertChain,
    } as unknown as DB;

    const result = upsertOpenClawConnection(db, {
      name: "Created OpenClaw",
      rootPath: "/tmp/new",
      hasGatewayToken: true,
      meta: { source: "wizard" },
    });

    assert.equal(result.created, true);
    assert.equal(capturedValues?.["name"], "Created OpenClaw");
    assert.equal(capturedValues?.["rootPath"], "/tmp/new");
    assert.equal(capturedValues?.["hasGatewayToken"], true);
    assert.equal(capturedValues?.["meta"], '{"source":"wizard"}');
  });

  it("updates an existing connection when rootPath matches", () => {
    let capturedSet: ConnectionPayload | undefined;
    const updatedRow = { ...FAKE_CONNECTION, name: "Updated OpenClaw" };
    const selectChain = makeChain(FAKE_CONNECTION, [FAKE_CONNECTION]);
    const insertChain: StubChain = {
      ...makeChain(updatedRow, [updatedRow]),
      onConflictDoNothing: () => insertChain,
      returning: () => insertChain,
      values: () => insertChain,
      get: () => null,
    };
    const updateChain: StubChain = {
      ...makeChain(updatedRow, [updatedRow]),
      returning: () => updateChain,
      set: (value) => {
        capturedSet = value;
        return updateChain;
      },
    };
    const db = {
      select: () => selectChain,
      insert: () => insertChain,
      transaction: (cb: (tx: DB) => unknown) => cb(db as unknown as DB),
      update: () => updateChain,
    } as unknown as DB;

    const result = upsertOpenClawConnection(db, {
      name: "Updated OpenClaw",
      rootPath: FAKE_CONNECTION.rootPath,
      syncMode: "manual",
    });

    assert.equal(result.created, false);
    assert.equal(capturedSet?.["name"], "Updated OpenClaw");
    assert.equal(capturedSet?.["syncMode"], "manual");
  });
});

describe("updateOpenClawConnection", () => {
  it("returns null when the connection does not exist", () => {
    const result = updateOpenClawConnection(makeDb(null, []), "missing", {
      name: "New Name",
    });
    assert.equal(result, null);
  });
});
