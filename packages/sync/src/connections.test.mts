import { describe, it, mock } from "node:test";
import assert from "node:assert";

/* eslint-disable @typescript-eslint/no-explicit-any */

const FAKE_CONNECTION = {
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
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function makeChain(row: any = FAKE_CONNECTION, rows: any[] = [FAKE_CONNECTION]): any {
  const c: any = {
    all: () => rows,
    get: () => row,
    returning: () => c,
    where: () => c,
    from: () => c,
    values: () => c,
    set: () => c,
    orderBy: () => c,
  };
  return c;
}

function makeDb(row?: any, rows?: any[]): any {
  const c = makeChain(row, rows);
  return { insert: () => c, select: () => c, update: () => c };
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
    const chain: any = {
      all: () => [],
      get: () => null,
      returning: () => chain,
      where: () => chain,
      from: () => chain,
      values: () => chain,
      set: () => chain,
      orderBy: () => chain,
    };
    const db = { insert: () => chain, select: () => chain, update: () => chain };
    const result = getOpenClawConnection(db as any, "missing");
    assert.equal(result, null);
  });
});

describe("upsertOpenClawConnection", () => {
  it("creates a new connection when none exists", () => {
    let capturedValues: any;
    let selectCount = 0;
    const insertRow = { ...FAKE_CONNECTION, name: "Created OpenClaw" };
    const selectChain: any = {
      get: () => {
        selectCount += 1;
        return null;
      },
      where: () => selectChain,
      from: () => selectChain,
    };
    const insertChain: any = {
      get: () => insertRow,
      values: (value: any) => {
        capturedValues = value;
        return insertChain;
      },
      returning: () => insertChain,
    };
    const db = {
      select: () => selectChain,
      insert: () => insertChain,
      update: () => insertChain,
    };

    const result = upsertOpenClawConnection(db as any, {
      name: "Created OpenClaw",
      rootPath: "/tmp/new",
      hasGatewayToken: true,
      meta: { source: "wizard" },
    });

    assert.equal(selectCount, 1);
    assert.equal(result.created, true);
    assert.equal(capturedValues.name, "Created OpenClaw");
    assert.equal(capturedValues.rootPath, "/tmp/new");
    assert.equal(capturedValues.hasGatewayToken, true);
    assert.equal(capturedValues.meta, '{"source":"wizard"}');
  });

  it("updates an existing connection when rootPath matches", () => {
    let capturedSet: any;
    const selectChain: any = {
      get: () => FAKE_CONNECTION,
      where: () => selectChain,
      from: () => selectChain,
    };
    const updateChain: any = {
      get: () => ({ ...FAKE_CONNECTION, name: "Updated OpenClaw" }),
      set: (value: any) => {
        capturedSet = value;
        return updateChain;
      },
      where: () => updateChain,
      returning: () => updateChain,
    };
    const db = {
      select: () => selectChain,
      insert: () => updateChain,
      update: () => updateChain,
    };

    const result = upsertOpenClawConnection(db as any, {
      name: "Updated OpenClaw",
      rootPath: FAKE_CONNECTION.rootPath,
      syncMode: "manual",
    });

    assert.equal(result.created, false);
    assert.equal(capturedSet.name, "Updated OpenClaw");
    assert.equal(capturedSet.syncMode, "manual");
  });
});

describe("updateOpenClawConnection", () => {
  it("returns null when the connection does not exist", () => {
    const selectChain: any = {
      get: () => null,
      where: () => selectChain,
      from: () => selectChain,
    };
    const updateChain: any = {
      get: () => null,
      set: () => updateChain,
      where: () => updateChain,
      returning: () => updateChain,
    };
    const db = {
      select: () => selectChain,
      insert: () => updateChain,
      update: () => updateChain,
    };

    const result = updateOpenClawConnection(db as any, "missing", { name: "New Name" });
    assert.equal(result, null);
  });
});
