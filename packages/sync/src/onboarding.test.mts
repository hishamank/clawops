import assert from "node:assert";
import { beforeEach, describe, it } from "node:test";

const eventsInserted: Array<Record<string, unknown>> = [];
const initAgentCalls: Array<Record<string, unknown>> = [];
const finishSyncRunWithTxCalls: Array<Record<string, unknown>> = [];
const upsertConnectionCalls: Array<Record<string, unknown>> = [];
const upsertCronJobsCalls: Array<Record<string, unknown>> = [];
const fetchGatewayCronJobsCalls: Array<Record<string, unknown>> = [];
const syncWorkspaceFilesCalls: Array<Record<string, unknown>> = [];
const syncSessionsCalls: Array<Record<string, unknown>> = [];
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

const { onboardOpenClaw } = await import("./onboarding.js");

beforeEach(() => {
  eventsInserted.length = 0;
  initAgentCalls.length = 0;
  finishSyncRunWithTxCalls.length = 0;
  upsertConnectionCalls.length = 0;
  upsertCronJobsCalls.length = 0;
  fetchGatewayCronJobsCalls.length = 0;
  syncWorkspaceFilesCalls.length = 0;
  syncSessionsCalls.length = 0;
  startSyncRunCalls.length = 0;
});

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
        upsertCronJobs: (_db: unknown, connectionId: string, jobs: Record<string, unknown>[]) => {
          upsertCronJobsCalls.push({ connectionId, jobs });
          return [];
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
        syncWorkspaceFiles: async (_db: unknown, connection: Record<string, unknown>) => {
          syncWorkspaceFilesCalls.push(connection);
          return {
            fetchedCount: 0,
            inserted: [],
            updated: [],
            unchangedCount: 0,
          };
        syncSessions: async (_db: unknown, syncedConnection: Record<string, unknown>) => {
          syncSessionsCalls.push(syncedConnection);
          return [];
        },
        startSyncRun: (_db: unknown, input: Record<string, unknown>) => {
          startSyncRunCalls.push(input);
          return { id: "run-1" };
        },
        finishSyncRunWithTx: (_db: unknown, id: string, input: Record<string, unknown>) => {
          finishSyncRunWithTxCalls.push({ id, input });
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
    assert.equal(finishSyncRunWithTxCalls.length, 1);
    assert.equal(upsertCronJobsCalls.length, 1);
    assert.equal(fetchGatewayCronJobsCalls.length, 1);
    assert.equal(syncWorkspaceFilesCalls.length, 1);
    assert.equal(syncSessionsCalls.length, 1);
    const finishSyncRunInput = finishSyncRunWithTxCalls[0]?.["input"] as Record<string, unknown>;
    assert.equal(finishSyncRunInput["connectionId"], "conn-1");
    assert.equal(syncWorkspaceFilesCalls[0]?.["id"], "conn-1");

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
