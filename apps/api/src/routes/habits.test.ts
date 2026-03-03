import { describe, it, mock } from "node:test";
import assert from "node:assert";

// ── Stubs ──────────────────────────────────────────────────────────────────

const fakeHabit = {
  id: "habit-1",
  agentId: "agent-1",
  name: "daily-check",
  type: "scheduled",
  status: "active",
  createdAt: new Date(),
};

const fakeRun = { id: "run-1", habitId: "habit-1", success: true };

const insertRunStub = mock.fn(() => {});
const insertValuesStub = mock.fn(() => ({ run: insertRunStub }));
const insertStub = mock.fn(() => ({ values: insertValuesStub }));
const txStub = { insert: insertStub };

const dbMock = {
  transaction: mock.fn((fn: (tx: unknown) => unknown) => fn(txStub)),
};

const fakeAgentRef = { id: "agent-1", name: "test-agent" } as { id: string; name: string } | null;
const createHabitStub = mock.fn(() => fakeHabit);
const listHabitsStub = mock.fn((..._args: unknown[]) => [fakeHabit]);
const logHabitRunStub = mock.fn(() => fakeRun);
const getAgentStub = mock.fn(() => fakeAgentRef);

// ── Module mocks ──────────────────────────────────────────────────────────

mock.module("@clawops/core", {
  namedExports: {
    db: dbMock,
    events: "events",
  },
});

mock.module("@clawops/habits", {
  namedExports: {
    createHabit: createHabitStub,
    listHabits: listHabitsStub,
    logHabitRun: logHabitRunStub,
  },
});

mock.module("@clawops/agents", {
  namedExports: {
    getAgent: getAgentStub,
  },
});

mock.module("@clawops/domain", {
  namedExports: {
    HabitType: {
      heartbeat: "heartbeat",
      scheduled: "scheduled",
      cron: "cron",
      hook: "hook",
      watchdog: "watchdog",
      polling: "polling",
    },
    HabitStatus: { active: "active", paused: "paused" },
  },
});

// ── Dynamic imports (after mocks) ─────────────────────────────────────────

const Fastify = (await import("fastify")).default;
const { habitRoutes } = await import("./habits.js");

// ── Test helpers ──────────────────────────────────────────────────────────

function buildApp(agentId?: string) {
  const app = Fastify();
  app.decorateRequest("agentId", undefined as string | undefined);
  app.addHook("onRequest", async (request) => {
    request.agentId = agentId;
  });
  app.register(habitRoutes);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("habitRoutes", () => {
  describe("POST /habits", () => {
    it("returns 201 with created habit", async () => {
      const app = buildApp("agent-1");
      const res = await app.inject({
        method: "POST",
        url: "/habits",
        payload: { name: "daily-check", type: "scheduled" },
      });
      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.name, "daily-check");
    });

    it("returns 400 on invalid body (missing type)", async () => {
      const app = buildApp("agent-1");
      const res = await app.inject({
        method: "POST",
        url: "/habits",
        payload: { name: "no-type" },
      });
      assert.strictEqual(res.statusCode, 400);
    });

    it("returns 400 for invalid HabitType enum value", async () => {
      const app = buildApp("agent-1");
      const res = await app.inject({
        method: "POST",
        url: "/habits",
        payload: { name: "bad", type: "INVALID_TYPE" },
      });
      assert.strictEqual(res.statusCode, 400);
    });

    it("returns 404 when agent not found", async () => {
      getAgentStub.mock.mockImplementation(() => null);
      const app = buildApp("missing-agent");
      const res = await app.inject({
        method: "POST",
        url: "/habits",
        payload: { name: "h", type: "heartbeat" },
      });
      assert.strictEqual(res.statusCode, 404);
      getAgentStub.mock.mockImplementation(() => ({ id: "agent-1", name: "test-agent" }));
    });

    it("wraps create + event insert in a transaction", async () => {
      dbMock.transaction.mock.resetCalls();
      const app = buildApp("agent-1");
      await app.inject({
        method: "POST",
        url: "/habits",
        payload: { name: "daily-check", type: "scheduled" },
      });
      assert.strictEqual(dbMock.transaction.mock.callCount(), 1);
    });
  });

  describe("GET /habits", () => {
    it("returns list of habits", async () => {
      const app = buildApp("agent-1");
      const res = await app.inject({ method: "GET", url: "/habits" });
      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.ok(Array.isArray(body));
      assert.strictEqual(body[0].name, "daily-check");
    });

    it("passes agentId query param to listHabits", async () => {
      listHabitsStub.mock.resetCalls();
      const app = buildApp("agent-1");
      await app.inject({ method: "GET", url: "/habits?agentId=agent-1" });
      assert.strictEqual(listHabitsStub.mock.callCount(), 1);
      assert.strictEqual((listHabitsStub.mock.calls[0].arguments as unknown[])[1], "agent-1");
    });
  });

  describe("POST /habits/:id/run", () => {
    it("returns 201 on successful run log", async () => {
      const app = buildApp("agent-1");
      const res = await app.inject({
        method: "POST",
        url: "/habits/habit-1/run",
        payload: { success: true, note: "all good" },
      });
      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.id, "run-1");
    });

    it("returns 400 on invalid body (missing success)", async () => {
      const app = buildApp("agent-1");
      const res = await app.inject({
        method: "POST",
        url: "/habits/habit-1/run",
        payload: { note: "no success field" },
      });
      assert.strictEqual(res.statusCode, 400);
    });

    it("returns 404 when habit not found", async () => {
      logHabitRunStub.mock.mockImplementation(() => {
        throw new Error("Habit not found");
      });
      const app = buildApp("agent-1");
      const res = await app.inject({
        method: "POST",
        url: "/habits/habit-1/run",
        payload: { success: true },
      });
      assert.strictEqual(res.statusCode, 404);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.code, "NOT_FOUND");
      logHabitRunStub.mock.mockImplementation(() => fakeRun);
    });

    it("wraps run log + event insert in a transaction", async () => {
      dbMock.transaction.mock.resetCalls();
      const app = buildApp("agent-1");
      await app.inject({
        method: "POST",
        url: "/habits/habit-1/run",
        payload: { success: true },
      });
      assert.strictEqual(dbMock.transaction.mock.callCount(), 1);
    });
  });
});
