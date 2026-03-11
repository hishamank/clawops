import assert from "node:assert";
import { beforeEach, describe, it, mock } from "node:test";

const eventsInserted: Array<Record<string, unknown>> = [];
const initAgentCalls: Array<Record<string, unknown>> = [];
const finishSyncRunCalls: Array<Record<string, unknown>> = [];
const upsertConnectionCalls: Array<Record<string, unknown>> = [];
const fetchGatewayCronJobsCalls: Array<Record<string, unknown>> = [];
const startSyncRunCalls: Array<Record<string, unknown>> = [];

const mockDb = {
  transaction<T>(callback: (tx: typeof mockDb) => T): T {
    return callback(mockDb);
  },
  insert(): { values: (value: Record<string, unknown>) => { run: () => void } } {
    return {
      values(value) {
        return {
          run() {
            eventsInserted.push(value);
          },
        };
      },
    };
  },
} as const;

beforeEach(() => {
  eventsInserted.length = 0;
  initAgentCalls.length = 0;
  finishSyncRunCalls.length = 0;
  upsertConnectionCalls.length = 0;
  fetchGatewayCronJobsCalls.length = 0;
  startSyncRunCalls.length = 0;
});

mock.module("@clawops/agents", {
  namedExports: {
    initAgent: (_db: unknown, input: Record<string, unknown>) => {
      initAgentCalls.push(input);
      return {
        agent: { id: "agent-1" },
        created: true,
      };
    },
  },
});

mock.module("@clawops/core", {
  namedExports: {
    events: Symbol("events"),
  },
});

mock.module("./connections.js", {
  namedExports: {
    upsertOpenClawConnection: (_db: unknown, input: Record<string, unknown>) => {
      upsertConnectionCalls.push(input);
      return {
        connection: {
          id: "conn-1",
          rootPath: input["rootPath"],
          gatewayUrl: input["gatewayUrl"],
        },
        created: true,
      };
    },
  },
});

mock.module("./openclaw/index.js", {
  namedExports: {
    scanOpenClaw: () => ({
      agents: [
        {
          id: "main",
          name: "Scout",
          workspacePath: "/tmp/openclaw/workspace-main",
          framework: "openclaw",
          model: "gpt-5",
          role: "researcher",
          skills: ["docs"],
          memoryPath: "/tmp/openclaw/workspace-main",
        },
      ],
      workspaces: [
        {
          agentId: "main",
          path: "/tmp/openclaw/workspace-main",
          files: { identity: "Scout" },
        },
      ],
      gatewayUrl: "http://localhost:4312",
    }),
    fetchGatewayCronJobs: async (gatewayUrl: string, gatewayToken: string) => {
      fetchGatewayCronJobsCalls.push({ gatewayUrl, gatewayToken });
      return [{ id: "cron-1", name: "Daily sync", schedule: "0 0 * * *", enabled: true }];
    },
  },
});

mock.module("./runs.js", {
  namedExports: {
    startSyncRun: (_db: unknown, input: Record<string, unknown>) => {
      startSyncRunCalls.push(input);
      return { id: "run-1" };
    },
    finishSyncRun: (_db: unknown, id: string, input: Record<string, unknown>) => {
      finishSyncRunCalls.push({ id, input });
      return { id, status: input["status"] };
    },
  },
});

const { onboardOpenClaw } = await import("./onboarding.js");

describe("onboardOpenClaw", () => {
  it("persists the shared onboarding side effects through package services", async () => {
    const result = await onboardOpenClaw(
      mockDb as never,
      {
        source: "test.onboarding",
        openclawDir: "/tmp/openclaw",
        gatewayToken: "secret",
        includeFiles: true,
      },
      {
        existsSync: (filePath: string) =>
          filePath === "/tmp/openclaw" || filePath === "/tmp/openclaw/openclaw.json",
        readdirSync: () => ["workspace-main"],
        initAgent: (_db: unknown, input: Record<string, unknown>) => {
          initAgentCalls.push(input);
          return {
            agent: { id: "agent-1" },
            created: true,
          };
        },
        upsertOpenClawConnection: (_db: unknown, input: Record<string, unknown>) => {
          upsertConnectionCalls.push(input);
          return {
            connection: {
              id: "conn-1",
              rootPath: input["rootPath"],
              gatewayUrl: input["gatewayUrl"],
            },
            created: true,
          };
        },
        scanOpenClaw: () => ({
          agents: [
            {
              id: "main",
              name: "Scout",
              workspacePath: "/tmp/openclaw/workspace-main",
              framework: "openclaw",
              model: "gpt-5",
              role: "researcher",
              skills: ["docs"],
              memoryPath: "/tmp/openclaw/workspace-main",
            },
          ],
          workspaces: [
            {
              agentId: "main",
              path: "/tmp/openclaw/workspace-main",
              files: { identity: "Scout" },
            },
          ],
          gatewayUrl: "http://localhost:4312",
        }),
        fetchGatewayCronJobs: async (gatewayUrl: string, gatewayToken: string) => {
          fetchGatewayCronJobsCalls.push({ gatewayUrl, gatewayToken });
          return [
            { id: "cron-1", name: "Daily sync", schedule: "0 0 * * *", enabled: true },
          ];
        },
        startSyncRun: (_db: unknown, input: Record<string, unknown>) => {
          startSyncRunCalls.push(input);
          return { id: "run-1" };
        },
        finishSyncRun: (_db: unknown, id: string, input: Record<string, unknown>) => {
          finishSyncRunCalls.push({ id, input });
          return { id, status: input["status"] };
        },
      },
    );

    assert.equal(result.connectionId, "conn-1");
    assert.equal(result.syncRunId, "run-1");
    assert.equal(result.agents.length, 1);
    assert.equal(result.cronJobs.length, 1);
    assert.equal(startSyncRunCalls.length, 1);
    assert.equal(upsertConnectionCalls.length, 1);
    assert.equal(initAgentCalls.length, 1);
    assert.equal(finishSyncRunCalls.length, 1);
    assert.equal(fetchGatewayCronJobsCalls.length, 1);

    const openclawIdentity = initAgentCalls[0]?.["openclaw"] as Record<string, unknown>;
    assert.equal(openclawIdentity["connectionId"], "conn-1");
    assert.equal(openclawIdentity["externalAgentId"], "main");
    assert.equal(openclawIdentity["externalAgentName"], "Scout");
    assert.equal(openclawIdentity["workspacePath"], "/tmp/openclaw/workspace-main");
    assert.equal(openclawIdentity["memoryPath"], "/tmp/openclaw/workspace-main");
    assert.equal(openclawIdentity["defaultModel"], "gpt-5");
    assert.equal(openclawIdentity["role"], "researcher");

    assert.deepEqual(
      eventsInserted.map((event) => event["action"]),
      ["openclaw.connection.created", "agent.registered", "sync.run.completed"],
    );
  });
});
