import { describe, it } from "node:test";
import assert from "node:assert";
import type { DB, OpenClawConnection, OpenClawSession } from "@clawops/core";
import {
  normalizeSession,
  OpenClawSessionFetchError,
  syncSessions,
} from "./sessions.js";

type SessionChain = {
  from: () => SessionChain;
  where: () => SessionChain;
  all: () => OpenClawSession[];
};

type UpdateChain = {
  set: () => UpdateChain;
  where: () => UpdateChain;
  returning: () => UpdateChain;
  all: () => OpenClawSession[];
};

function makeConnection(): OpenClawConnection {
  return {
    id: "conn-1",
    provider: "openclaw",
    name: "OpenClaw Local",
    rootPath: "/tmp/.openclaw",
    gatewayUrl: "https://gateway.example.test",
    status: "active",
    syncMode: "hybrid",
    hasGatewayToken: false,
    meta: null,
    lastSyncedAt: null,
    createdAt: new Date("2026-03-12T00:00:00.000Z"),
    updatedAt: new Date("2026-03-12T00:00:00.000Z"),
  };
}

function makeActiveSession(): OpenClawSession {
  return {
    id: "session-row-1",
    connectionId: "conn-1",
    sessionKey: "existing-active-session",
    agentId: "agent-1",
    model: "gpt-5",
    status: "active",
    startedAt: new Date("2026-03-12T08:00:00.000Z"),
    endedAt: null,
    metadata: null,
    createdAt: new Date("2026-03-12T08:00:00.000Z"),
    updatedAt: new Date("2026-03-12T08:00:00.000Z"),
  };
}

function makeDb(options?: {
  previouslyActive?: OpenClawSession[];
  onTransaction?: () => void;
  onUpdate?: () => void;
}): DB {
  const previouslyActive = options?.previouslyActive ?? [makeActiveSession()];

  const selectChain: SessionChain = {
    from: () => selectChain,
    where: () => selectChain,
    all: () => previouslyActive,
  };

  const updateChain: UpdateChain = {
    set: () => {
      options?.onUpdate?.();
      return updateChain;
    },
    where: () => updateChain,
    returning: () => updateChain,
    all: () => [],
  };

  const db = {
    select: () => selectChain,
    update: () => updateChain,
    transaction: <T>(callback: (tx: DB) => T): T => {
      options?.onTransaction?.();
      return callback(db as unknown as DB);
    },
  };

  return db as unknown as DB;
}

describe("normalizeSession", () => {
  it("normalizes top-level snake_case fields", () => {
    const result = normalizeSession({
      session_key: "session-1",
      agent_id: "agent-1",
      model: "gpt-5",
      started_at: "2026-03-12T08:00:00.000Z",
    });

    assert.ok(result);
    assert.equal(result?.sessionKey, "session-1");
    assert.equal(result?.agentId, "agent-1");
    assert.equal(result?.model, "gpt-5");
    assert.equal(result?.startedAt.toISOString(), "2026-03-12T08:00:00.000Z");
    assert.equal(result?.status, "active");
    assert.equal(result?.endedAt, null);
  });

  it("pulls agent and model from nested gateway payloads", () => {
    const result = normalizeSession({
      key: "session-2",
      payload: {
        agent_id: "agent-2",
      },
      state: {
        model: "claude-sonnet",
        started_at: 1_741_769_600,
      },
    });

    assert.ok(result);
    assert.equal(result?.sessionKey, "session-2");
    assert.equal(result?.agentId, "agent-2");
    assert.equal(result?.model, "claude-sonnet");
    assert.equal(result?.startedAt.toISOString(), "2025-03-12T08:53:20.000Z");
  });

  it("falls back to id and connectedAt timestamps", () => {
    const result = normalizeSession({
      id: "session-3",
      connectedAt: "1741776000000",
    });

    assert.ok(result);
    assert.equal(result?.sessionKey, "session-3");
    assert.equal(result?.startedAt.toISOString(), "2025-03-12T10:40:00.000Z");
    assert.equal(result?.metadata?.["id"], "session-3");
  });

  it("returns null when no usable session key exists", () => {
    assert.equal(
      normalizeSession({
        agentId: "agent-4",
        startedAt: "2026-03-12T08:00:00.000Z",
      }),
      null,
    );
  });
});

describe("syncSessions", () => {
  it("does not mark active sessions as ended when fetching gateway sessions fails", async () => {
    let transactionCount = 0;
    let updateCount = 0;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new TypeError("network down");
    };

    try {
      await assert.rejects(
        syncSessions(
          makeDb({
            onTransaction: () => {
              transactionCount += 1;
            },
            onUpdate: () => {
              updateCount += 1;
            },
          }),
          makeConnection(),
        ),
        (error: unknown) =>
          error instanceof OpenClawSessionFetchError
          && error.message === "Aborted OpenClaw session sync for connection conn-1",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(transactionCount, 0);
    assert.equal(updateCount, 0);
  });
});
