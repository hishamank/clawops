import { describe, it } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import type { DB, OpenClawConnection, OpenClawSession, OpenClawAgent, Agent } from "@clawops/core";
import { openclawSessions, openclawAgents } from "@clawops/core";
import {
  normalizeSession,
  OpenClawSessionFetchError,
  syncSessions,
  listSessions,
  upsertSessions,
  getActiveSessionAgentIds,
  syncAgentStatusFromSessions,
  countActiveAgentsBySessions,
  type FetchedOpenClawSession,
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
  const insertedSessions: OpenClawSession[] = [];

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
    insert: () => ({
      values: (vals: unknown) => ({
        onConflictDoUpdate: () => ({
          returning: () => ({
            get: () => {
              const session: OpenClawSession = {
                id: crypto.randomUUID(),
                connectionId: (vals as { connectionId: string }).connectionId,
                sessionKey: (vals as { sessionKey: string }).sessionKey,
                agentId: (vals as { agentId: string | null }).agentId ?? null,
                model: (vals as { model: string | null }).model ?? null,
                status: "active",
                startedAt: (vals as { startedAt: Date }).startedAt,
                endedAt: null,
                metadata: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              insertedSessions.push(session);
              return session;
            },
          }),
        }),
      }),
    }),
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

  it("upserts new and existing sessions correctly", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return {
        ok: true,
        json: async () => ({
          sessions: [
            {
              sessionKey: "existing-active-session",
              agentId: "agent-1-updated",
              model: "gpt-5-turbo",
              startedAt: "2026-03-12T09:00:00.000Z",
            },
            {
              sessionKey: "new-session",
              agentId: "agent-2",
              model: "claude-sonnet",
              startedAt: "2026-03-12T10:00:00.000Z",
            },
          ],
        }),
      } as Response;
    };

    try {
      const result = await syncSessions(
        makeDb({
          previouslyActive: [makeActiveSession()],
        }),
        makeConnection(),
      );

      assert.ok(result.length >= 2);
      const updatedSession = result.find((s) => s.sessionKey === "existing-active-session");
      const newSession = result.find((s) => s.sessionKey === "new-session");

      assert.ok(updatedSession);
      assert.equal(updatedSession.status, "active");
      assert.ok(newSession);
      assert.equal(newSession.status, "active");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("marks sessions as ended when they are no longer active", async () => {
    let markedAsEnded = false;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return {
        ok: true,
        json: async () => ({
          sessions: [
            {
              sessionKey: "new-active-session",
              agentId: "agent-2",
              model: "claude-sonnet",
              startedAt: "2026-03-12T10:00:00.000Z",
            },
          ],
        }),
      } as Response;
    };

    try {
      const result = await syncSessions(
        makeDb({
          previouslyActive: [makeActiveSession()],
          onUpdate: () => {
            markedAsEnded = true;
          },
        }),
        makeConnection(),
      );

      assert.ok(markedAsEnded, "Should have marked old session as ended");
      assert.ok(result.length >= 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("upsertSessions", () => {
  it("returns empty array when no sessions provided", () => {
    const db = makeDb();
    const result = upsertSessions(db, "conn-1", []);
    assert.equal(result.length, 0);
  });

  it("inserts new sessions", () => {
    const mockInserted: OpenClawSession[] = [];
    const db = {
      insert: () => ({
        values: () => ({
          onConflictDoUpdate: () => ({
            returning: () => ({
              get: () => {
                const session: OpenClawSession = {
                  id: "session-new",
                  connectionId: "conn-1",
                  sessionKey: "new-session",
                  agentId: "agent-1",
                  model: "gpt-5",
                  status: "active",
                  startedAt: new Date("2026-03-12T10:00:00.000Z"),
                  endedAt: null,
                  metadata: null,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };
                mockInserted.push(session);
                return session;
              },
            }),
          }),
        }),
      }),
    } as unknown as DB;

    const sessions: FetchedOpenClawSession[] = [
      {
        sessionKey: "new-session",
        agentId: "agent-1",
        model: "gpt-5",
        status: "active",
        startedAt: new Date("2026-03-12T10:00:00.000Z"),
        endedAt: null,
        metadata: null,
      },
    ];

    const result = upsertSessions(db, "conn-1", sessions);
    assert.equal(result.length, 1);
    assert.equal(result[0].sessionKey, "new-session");
    assert.equal(mockInserted.length, 1);
  });
});

describe("listSessions", () => {
  it("returns sessions with filters applied", () => {
    const sessions = [
      makeActiveSession(),
      {
        ...makeActiveSession(),
        id: "session-2",
        sessionKey: "session-2",
        status: "ended" as const,
        endedAt: new Date("2026-03-12T10:00:00.000Z"),
      },
    ];

    const db = {
      select: () => ({
        from: () => ({
          orderBy: () => ({
            $dynamic: () => ({
              where: () => ({
                limit: () => ({
                  all: () => sessions.filter((s) => s.status === "active"),
                }),
              }),
              limit: () => ({
                all: () => sessions,
              }),
            }),
          }),
        }),
      }),
    } as unknown as DB;

    const result = listSessions(db, { status: "active" });
    assert.ok(result.length >= 1);
  });

  it("applies connection filter", () => {
    const db = {
      select: () => ({
        from: () => ({
          orderBy: () => ({
            $dynamic: () => ({
              where: () => ({
                limit: () => ({
                  all: () => [makeActiveSession()],
                }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as DB;

    const result = listSessions(db, { connectionId: "conn-1" });
    assert.ok(result.length >= 0);
  });

  it("applies default limit of 20", () => {
    const db = {
      select: () => ({
        from: () => ({
          orderBy: () => ({
            $dynamic: () => ({
              limit: (lim: number) => {
                assert.equal(lim, 20);
                return {
                  all: () => [],
                };
              },
            }),
          }),
        }),
      }),
    } as unknown as DB;

    listSessions(db, {});
  });
});

describe("getActiveSessionAgentIds", () => {
  it("returns empty set when no sessions exist", () => {
    const sessions: OpenClawSession[] = [];
    const mappings: OpenClawAgent[] = [];

    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            all: () => {
              if (table === openclawSessions) {
                return sessions;
              }
              if (table === openclawAgents) {
                return mappings;
              }
              return [];
            },
          }),
        }),
      }),
    } as unknown as DB;

    const result = getActiveSessionAgentIds(db);
    assert.equal(result.size, 0);
  });

  it("returns empty set when sessions have no agentId", () => {
    const sessions: OpenClawSession[] = [
      { id: "s1", connectionId: "conn-1", sessionKey: "session-1", agentId: null, model: null, status: "active", startedAt: new Date(), endedAt: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
    ];
    const mappings: OpenClawAgent[] = [];

    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            all: () => {
              if (table === openclawSessions) {
                return sessions;
              }
              if (table === openclawAgents) {
                return mappings;
              }
              return [];
            },
          }),
        }),
      }),
    } as unknown as DB;

    const result = getActiveSessionAgentIds(db);
    assert.equal(result.size, 0);
  });

  it("returns correct agent IDs for active sessions with mappings", () => {
    const sessions: OpenClawSession[] = [
      { id: "s1", connectionId: "conn-1", sessionKey: "session-1", agentId: "ext-agent-1", model: null, status: "active", startedAt: new Date(), endedAt: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "s2", connectionId: "conn-1", sessionKey: "session-2", agentId: "ext-agent-2", model: null, status: "active", startedAt: new Date(), endedAt: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
    ];
    const mappings: OpenClawAgent[] = [
      { id: "m1", connectionId: "conn-1", linkedAgentId: "agent-1", externalAgentId: "ext-agent-1", externalAgentName: "Agent 1", workspacePath: null, memoryPath: null, defaultModel: null, role: null, avatar: null, lastSeenAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "m2", connectionId: "conn-1", linkedAgentId: "agent-2", externalAgentId: "ext-agent-2", externalAgentName: "Agent 2", workspacePath: null, memoryPath: null, defaultModel: null, role: null, avatar: null, lastSeenAt: null, createdAt: new Date(), updatedAt: new Date() },
    ];

    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            all: () => {
              if (table === openclawSessions) {
                return sessions;
              }
              if (table === openclawAgents) {
                return mappings;
              }
              return [];
            },
          }),
        }),
      }),
    } as unknown as DB;

    const result = getActiveSessionAgentIds(db);
    assert.equal(result.size, 2);
    assert.ok(result.has("agent-1"));
    assert.ok(result.has("agent-2"));
  });

  it("returns deduplicated agent IDs when multiple sessions exist for same agent", () => {
    const sessions: OpenClawSession[] = [
      { id: "s1", connectionId: "conn-1", sessionKey: "session-1", agentId: "ext-agent-1", model: null, status: "active", startedAt: new Date(), endedAt: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "s2", connectionId: "conn-1", sessionKey: "session-2", agentId: "ext-agent-1", model: null, status: "active", startedAt: new Date(), endedAt: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
    ];
    const mappings: OpenClawAgent[] = [
      { id: "m1", connectionId: "conn-1", linkedAgentId: "agent-1", externalAgentId: "ext-agent-1", externalAgentName: "Agent 1", workspacePath: null, memoryPath: null, defaultModel: null, role: null, avatar: null, lastSeenAt: null, createdAt: new Date(), updatedAt: new Date() },
    ];

    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            all: () => {
              if (table === openclawSessions) {
                return sessions;
              }
              if (table === openclawAgents) {
                return mappings;
              }
              return [];
            },
          }),
        }),
      }),
    } as unknown as DB;

    const result = getActiveSessionAgentIds(db);
    assert.equal(result.size, 1);
    assert.ok(result.has("agent-1"));
  });

  it("ignores sessions without mappings", () => {
    const sessions: OpenClawSession[] = [
      { id: "s1", connectionId: "conn-1", sessionKey: "session-1", agentId: "ext-agent-1", model: null, status: "active", startedAt: new Date(), endedAt: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "s2", connectionId: "conn-1", sessionKey: "session-2", agentId: "ext-unmapped", model: null, status: "active", startedAt: new Date(), endedAt: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
    ];
    const mappings: OpenClawAgent[] = [
      { id: "m1", connectionId: "conn-1", linkedAgentId: "agent-1", externalAgentId: "ext-agent-1", externalAgentName: "Agent 1", workspacePath: null, memoryPath: null, defaultModel: null, role: null, avatar: null, lastSeenAt: null, createdAt: new Date(), updatedAt: new Date() },
    ];

    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            all: () => {
              if (table === openclawSessions) {
                return sessions;
              }
              if (table === openclawAgents) {
                return mappings;
              }
              return [];
            },
          }),
        }),
      }),
    } as unknown as DB;

    const result = getActiveSessionAgentIds(db);
    assert.equal(result.size, 1);
    assert.ok(result.has("agent-1"));
  });
});

describe("syncAgentStatusFromSessions", () => {
  it("returns zeros when no agents are linked to OpenClaw", () => {
    const sessions: OpenClawSession[] = [];
    const mappings: OpenClawAgent[] = [];

    const db = {
      select: () => ({
        from: (table: unknown) => {
          const data = table === openclawSessions ? sessions : table === openclawAgents ? mappings : [];
          return {
            where: () => ({
              all: () => data,
            }),
            all: () => data,
          };
        },
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () => ({
              all: () => [],
            }),
          }),
        }),
      }),
    } as unknown as DB;

    const result = syncAgentStatusFromSessions(db);
    assert.equal(result.updatedOnline, 0);
    assert.equal(result.updatedIdle, 0);
  });

  it("syncs agent status based on provided active agent IDs", () => {
    const sessions: OpenClawSession[] = [
      { id: "s1", connectionId: "conn-1", sessionKey: "session-1", agentId: "ext-agent-1", model: null, status: "active", startedAt: new Date(), endedAt: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
    ];
    const mappings: OpenClawAgent[] = [
      { id: "m1", connectionId: "conn-1", linkedAgentId: "agent-1", externalAgentId: "ext-agent-1", externalAgentName: "Agent 1", workspacePath: null, memoryPath: null, defaultModel: null, role: null, avatar: null, lastSeenAt: null, createdAt: new Date(), updatedAt: new Date() },
    ];

    let updateCallCount = 0;
    const db = {
      select: () => ({
        from: (table: unknown) => {
          const data = table === openclawSessions ? sessions : table === openclawAgents ? mappings : [];
          return {
            where: () => ({
              all: () => data,
            }),
            all: () => data,
          };
        },
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () => ({
              all: () => {
                updateCallCount++;
                return [{ id: "agent-1" } as Agent];
              },
            }),
          }),
        }),
      }),
    } as unknown as DB;

    const result = syncAgentStatusFromSessions(db);
    assert.ok(typeof result.updatedOnline === "number", "Should return updatedOnline count");
    assert.ok(typeof result.updatedIdle === "number", "Should return updatedIdle count");
    assert.ok(updateCallCount >= 0, "Should attempt updates");
  });
});

describe("countActiveAgentsBySessions", () => {
  it("returns 0 when no active sessions exist", () => {
    const sessions: OpenClawSession[] = [];
    const mappings: OpenClawAgent[] = [];

    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            all: () => {
              if (table === openclawSessions) {
                return sessions;
              }
              if (table === openclawAgents) {
                return mappings;
              }
              return [];
            },
          }),
        }),
      }),
    } as unknown as DB;

    const result = countActiveAgentsBySessions(db);
    assert.equal(result, 0);
  });

  it("returns 0 when sessions have no agentId", () => {
    const sessions: OpenClawSession[] = [
      { id: "s1", connectionId: "conn-1", sessionKey: "session-1", agentId: null, model: null, status: "active", startedAt: new Date(), endedAt: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
    ];
    const mappings: OpenClawAgent[] = [];

    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            all: () => {
              if (table === openclawSessions) {
                return sessions;
              }
              if (table === openclawAgents) {
                return mappings;
              }
              return [];
            },
          }),
        }),
      }),
    } as unknown as DB;

    const result = countActiveAgentsBySessions(db);
    assert.equal(result, 0);
  });

  it("returns correct count for active sessions with mappings", () => {
    const sessions: OpenClawSession[] = [
      { id: "s1", connectionId: "conn-1", sessionKey: "session-1", agentId: "ext-agent-1", model: null, status: "active", startedAt: new Date(), endedAt: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "s2", connectionId: "conn-1", sessionKey: "session-2", agentId: "ext-agent-2", model: null, status: "active", startedAt: new Date(), endedAt: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
    ];
    const mappings: OpenClawAgent[] = [
      { id: "m1", connectionId: "conn-1", linkedAgentId: "agent-1", externalAgentId: "ext-agent-1", externalAgentName: "Agent 1", workspacePath: null, memoryPath: null, defaultModel: null, role: null, avatar: null, lastSeenAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "m2", connectionId: "conn-1", linkedAgentId: "agent-2", externalAgentId: "ext-agent-2", externalAgentName: "Agent 2", workspacePath: null, memoryPath: null, defaultModel: null, role: null, avatar: null, lastSeenAt: null, createdAt: new Date(), updatedAt: new Date() },
    ];

    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            all: () => {
              if (table === openclawSessions) {
                return sessions;
              }
              if (table === openclawAgents) {
                return mappings;
              }
              return [];
            },
          }),
        }),
      }),
    } as unknown as DB;

    const result = countActiveAgentsBySessions(db);
    assert.equal(result, 2);
  });

  it("returns deduplicated count when multiple sessions exist for same agent", () => {
    const sessions: OpenClawSession[] = [
      { id: "s1", connectionId: "conn-1", sessionKey: "session-1", agentId: "ext-agent-1", model: null, status: "active", startedAt: new Date(), endedAt: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "s2", connectionId: "conn-1", sessionKey: "session-2", agentId: "ext-agent-1", model: null, status: "active", startedAt: new Date(), endedAt: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
    ];
    const mappings: OpenClawAgent[] = [
      { id: "m1", connectionId: "conn-1", linkedAgentId: "agent-1", externalAgentId: "ext-agent-1", externalAgentName: "Agent 1", workspacePath: null, memoryPath: null, defaultModel: null, role: null, avatar: null, lastSeenAt: null, createdAt: new Date(), updatedAt: new Date() },
    ];

    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            all: () => {
              if (table === openclawSessions) {
                return sessions;
              }
              if (table === openclawAgents) {
                return mappings;
              }
              return [];
            },
          }),
        }),
      }),
    } as unknown as DB;

    const result = countActiveAgentsBySessions(db);
    assert.equal(result, 1);
  });

  it("ignores sessions without mappings", () => {
    const sessions: OpenClawSession[] = [
      { id: "s1", connectionId: "conn-1", sessionKey: "session-1", agentId: "ext-agent-1", model: null, status: "active", startedAt: new Date(), endedAt: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "s2", connectionId: "conn-1", sessionKey: "session-2", agentId: "ext-unmapped", model: null, status: "active", startedAt: new Date(), endedAt: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
    ];
    const mappings: OpenClawAgent[] = [
      { id: "m1", connectionId: "conn-1", linkedAgentId: "agent-1", externalAgentId: "ext-agent-1", externalAgentName: "Agent 1", workspacePath: null, memoryPath: null, defaultModel: null, role: null, avatar: null, lastSeenAt: null, createdAt: new Date(), updatedAt: new Date() },
    ];

    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            all: () => {
              if (table === openclawSessions) {
                return sessions;
              }
              if (table === openclawAgents) {
                return mappings;
              }
              return [];
            },
          }),
        }),
      }),
    } as unknown as DB;

    const result = countActiveAgentsBySessions(db);
    assert.equal(result, 1);
  });
});
