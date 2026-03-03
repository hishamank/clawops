import { describe, it, before, after, mock, beforeEach } from "node:test";
import assert from "node:assert";

// ── Stubs ──────────────────────────────────────────────────────────────────

const fakeAgent = {
  id: "agent-1",
  name: "test-agent",
  model: "gpt-4",
  role: "dev",
  framework: "langchain",
  apiKey: "secret-key",
  status: "online",
  skills: '["code"]',
  createdAt: new Date(),
};

const insertRunStub = mock.fn(() => {});
const insertValuesStub = mock.fn(() => ({ run: insertRunStub }));
const insertStub = mock.fn(() => ({ values: insertValuesStub }));
const txStub = { insert: insertStub };

const dbMock = {
  transaction: mock.fn((fn: (tx: unknown) => unknown) => fn(txStub)),
  select: mock.fn(() => ({
    from: mock.fn(() => ({
      where: mock.fn(() => ({
        orderBy: mock.fn(() => ({
          limit: mock.fn(() => ({
            all: mock.fn(() => []),
          })),
        })),
      })),
    })),
  })),
};

const createAgentStub = mock.fn(() => fakeAgent as typeof fakeAgent | null);
const getAgentStub = mock.fn(() => fakeAgent as typeof fakeAgent | null);
const listAgentsStub = mock.fn(() => [fakeAgent]);
const updateAgentStatusStub = mock.fn(() => fakeAgent);
const updateAgentSkillsStub = mock.fn(() => fakeAgent);
const listHabitsStub = mock.fn((): unknown[] => []);
const getHabitStreakStub = mock.fn(() => 3);
const logHeartbeatStub = mock.fn(() => ({ id: "run-1" }));

// ── Module mocks ──────────────────────────────────────────────────────────

mock.module("@clawops/core", {
  namedExports: {
    db: dbMock,
    events: "events",
    tasks: { assigneeId: "assigneeId", createdAt: "createdAt" },
    eq: (a: unknown, b: unknown) => [a, b],
    desc: (a: unknown) => a,
  },
});

mock.module("@clawops/agents", {
  namedExports: {
    createAgent: createAgentStub,
    getAgent: getAgentStub,
    listAgents: listAgentsStub,
    updateAgentStatus: updateAgentStatusStub,
    updateAgentSkills: updateAgentSkillsStub,
  },
});

mock.module("@clawops/habits", {
  namedExports: {
    listHabits: listHabitsStub,
    getHabitStreak: getHabitStreakStub,
    logHeartbeat: logHeartbeatStub,
  },
});

mock.module("@clawops/domain", {
  namedExports: {
    AgentStatus: { online: "online", idle: "idle", busy: "busy", offline: "offline" },
  },
});

// ── Dynamic imports (after mocks) ─────────────────────────────────────────

const Fastify = (await import("fastify")).default;
const { agentRoutes } = await import("./agents.js");

// ── Test helpers ──────────────────────────────────────────────────────────

function buildApp(agentId?: string) {
  const app = Fastify();
  // Simulate auth middleware setting agentId
  app.decorateRequest("agentId", undefined as string | undefined);
  app.addHook("onRequest", async (request) => {
    request.agentId = agentId;
  });
  app.register(agentRoutes);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("agentRoutes", () => {
  describe("POST /agents/register", () => {
    it("returns 201 with agent data on valid input", async () => {
      const app = buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/agents/register",
        payload: { name: "a", model: "m", role: "r", framework: "f" },
      });
      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.apiKey, "secret-key");
      assert.strictEqual(body.name, "test-agent");
    });

    it("returns 400 on invalid body", async () => {
      const app = buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/agents/register",
        payload: { name: "" },
      });
      assert.strictEqual(res.statusCode, 400);
    });

    it("wraps create + event insert in a transaction", async () => {
      dbMock.transaction.mock.resetCalls();
      const app = buildApp();
      await app.inject({
        method: "POST",
        url: "/agents/register",
        payload: { name: "a", model: "m", role: "r", framework: "f" },
      });
      assert.strictEqual(dbMock.transaction.mock.callCount(), 1);
    });
  });

  describe("GET /agents", () => {
    it("returns agents with apiKey stripped", async () => {
      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/agents" });
      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.ok(Array.isArray(body));
      assert.strictEqual(body[0].apiKey, undefined);
      assert.strictEqual(body[0].name, "test-agent");
    });
  });

  describe("GET /agents/:id", () => {
    it("returns 404 when agent does not exist", async () => {
      getAgentStub.mock.mockImplementation(() => null);
      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/agents/unknown" });
      assert.strictEqual(res.statusCode, 404);
      getAgentStub.mock.mockImplementation(() => fakeAgent);
    });

    it("returns agent detail with tasks, habits, streaks", async () => {
      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/agents/agent-1" });
      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.ok("recentTasks" in body);
      assert.ok("habits" in body);
      assert.ok("streaks" in body);
      assert.strictEqual(body.apiKey, undefined);
    });
  });

  describe("PATCH /agents/:id/status – auth scoping", () => {
    it("returns 403 when params.id !== request.agentId", async () => {
      const app = buildApp("other-agent");
      const res = await app.inject({
        method: "PATCH",
        url: "/agents/agent-1/status",
        payload: { status: "online" },
      });
      assert.strictEqual(res.statusCode, 403);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.code, "FORBIDDEN");
    });

    it("returns 200 when params.id matches agentId", async () => {
      const app = buildApp("agent-1");
      const res = await app.inject({
        method: "PATCH",
        url: "/agents/agent-1/status",
        payload: { status: "online" },
      });
      assert.strictEqual(res.statusCode, 200);
    });

    it("returns 400 for invalid enum value", async () => {
      const app = buildApp("agent-1");
      const res = await app.inject({
        method: "PATCH",
        url: "/agents/agent-1/status",
        payload: { status: "INVALID_STATUS" },
      });
      assert.strictEqual(res.statusCode, 400);
    });

    it("wraps status update + event in a transaction", async () => {
      dbMock.transaction.mock.resetCalls();
      const app = buildApp("agent-1");
      await app.inject({
        method: "PATCH",
        url: "/agents/agent-1/status",
        payload: { status: "idle" },
      });
      assert.strictEqual(dbMock.transaction.mock.callCount(), 1);
    });
  });

  describe("PATCH /agents/:id/skills – auth scoping", () => {
    it("returns 403 when params.id !== request.agentId", async () => {
      const app = buildApp("other-agent");
      const res = await app.inject({
        method: "PATCH",
        url: "/agents/agent-1/skills",
        payload: { skills: ["code"] },
      });
      assert.strictEqual(res.statusCode, 403);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.code, "FORBIDDEN");
    });

    it("returns 200 when params.id matches agentId", async () => {
      const app = buildApp("agent-1");
      const res = await app.inject({
        method: "PATCH",
        url: "/agents/agent-1/skills",
        payload: { skills: ["code", "test"] },
      });
      assert.strictEqual(res.statusCode, 200);
    });
  });

  describe("POST /agents/:id/heartbeat – auth scoping", () => {
    it("returns 403 when params.id !== request.agentId", async () => {
      const app = buildApp("other-agent");
      const res = await app.inject({
        method: "POST",
        url: "/agents/agent-1/heartbeat",
      });
      assert.strictEqual(res.statusCode, 403);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.code, "FORBIDDEN");
    });

    it("returns 201 on valid heartbeat", async () => {
      const app = buildApp("agent-1");
      const res = await app.inject({
        method: "POST",
        url: "/agents/agent-1/heartbeat",
      });
      assert.strictEqual(res.statusCode, 201);
    });

    it("returns 404 when agent does not exist", async () => {
      getAgentStub.mock.mockImplementation(() => null);
      const app = buildApp("unknown");
      const res = await app.inject({
        method: "POST",
        url: "/agents/unknown/heartbeat",
      });
      assert.strictEqual(res.statusCode, 404);
      getAgentStub.mock.mockImplementation(() => fakeAgent);
    });
  });
});
