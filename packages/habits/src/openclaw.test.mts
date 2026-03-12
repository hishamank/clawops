import assert from "node:assert";
import { describe, it, mock } from "node:test";
import type { DB, Habit } from "@clawops/core";
import type {
  fetchCronJobs as FetchCronJobs,
  listCronJobs as ListCronJobs,
  upsertCronJobs as UpsertCronJobs,
} from "./openclaw.js";

type Condition =
  | { kind: "eq"; column: string; value: unknown }
  | { kind: "and"; conditions: Condition[] };

interface FakeOpenClawAgent extends Record<string, unknown> {
  connectionId: string;
  externalAgentId: string;
  linkedAgentId: string;
  updatedAt: Date;
}

interface HabitInsertValues {
  id: string;
  connectionId: string;
  agentId: string;
  externalId: string;
  name: string;
  type: OpenClawHabit["type"];
  schedule: string | null;
  cronExpr: string | null;
  scheduleKind: string | null;
  scheduleExpr: string | null;
  sessionTarget: string | null;
  trigger: string | null;
  status: "active" | "paused";
  enabled: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
  lastSyncedAt: Date;
}

type OpenClawHabit = Habit & Record<string, unknown> & {
  externalId: string | null;
  connectionId: string | null;
  scheduleKind: string | null;
  scheduleExpr: string | null;
  sessionTarget: string | null;
  createdAt: Date;
};

const HABITS = Symbol("habits");
const OPENCLAW_AGENTS = Symbol("openclawAgents");
const OPENCLAW_CONNECTIONS = Symbol("openclawConnections");

mock.module("@clawops/core", {
  namedExports: {
    habits: {
      id: "id",
      agentId: "agentId",
      connectionId: "connectionId",
      externalId: "externalId",
      name: "name",
      type: "type",
      schedule: "schedule",
      cronExpr: "cronExpr",
      scheduleKind: "scheduleKind",
      scheduleExpr: "scheduleExpr",
      sessionTarget: "sessionTarget",
      trigger: "trigger",
      status: "status",
      enabled: "enabled",
      lastRun: "lastRun",
      nextRun: "nextRun",
      lastSyncedAt: "lastSyncedAt",
      createdAt: "createdAt",
      __table: HABITS,
    },
    openclawAgents: {
      connectionId: "connectionId",
      externalAgentId: "externalAgentId",
      linkedAgentId: "linkedAgentId",
      updatedAt: "updatedAt",
      __table: OPENCLAW_AGENTS,
    },
    openclawConnections: {
      id: "id",
      gatewayUrl: "gatewayUrl",
      hasGatewayToken: "hasGatewayToken",
      __table: OPENCLAW_CONNECTIONS,
    },
    eq: (column: string, value: unknown): Condition => ({ kind: "eq", column, value }),
    and: (...conditions: Condition[]): Condition => ({ kind: "and", conditions }),
    desc: (column: string) => ({ kind: "desc", column }),
  },
});

const openclawModule = (await import(
  new URL("../dist/openclaw.js", import.meta.url).pathname
)) as {
  fetchCronJobs: typeof FetchCronJobs;
  listCronJobs: typeof ListCronJobs;
  upsertCronJobs: typeof UpsertCronJobs;
};
const { fetchCronJobs, listCronJobs, upsertCronJobs } = openclawModule;

interface FakeDbState {
  habits: OpenClawHabit[];
  openclawAgents: FakeOpenClawAgent[];
}

function matchesCondition(
  row: Record<string, unknown>,
  condition: Condition | null,
): boolean {
  if (!condition) {
    return true;
  }

  if (condition.kind === "eq") {
    return row[condition.column] === condition.value;
  }

  return condition.conditions.every((entry) => matchesCondition(row, entry));
}

function sortRows<TRow extends Record<string, unknown>>(
  rows: TRow[],
  order: { kind: "desc"; column: string } | null,
): TRow[] {
  if (!order) {
    return [...rows];
  }

  return [...rows].sort((left, right) => {
    const leftValue = left[order.column];
    const rightValue = right[order.column];

    if (leftValue instanceof Date && rightValue instanceof Date) {
      return rightValue.getTime() - leftValue.getTime();
    }

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return rightValue - leftValue;
    }

    return String(rightValue).localeCompare(String(leftValue));
  });
}

function createFakeDb(state: FakeDbState): DB {
  const db = {
    select() {
      return {
        from(table: { __table: symbol }) {
          let condition: Condition | null = null;
          let order: { kind: "desc"; column: string } | null = null;

          return {
            where(nextCondition: Condition) {
              condition = nextCondition;
              return this;
            },
            orderBy(nextOrder: { kind: "desc"; column: string }) {
              order = nextOrder;
              return this;
            },
            all() {
              if (table.__table === HABITS) {
                return sortRows(state.habits, order).filter((row) => matchesCondition(row, condition));
              }

              if (table.__table === OPENCLAW_AGENTS) {
                return sortRows(state.openclawAgents, order).filter((row) =>
                  matchesCondition(row, condition),
                );
              }

              return [];
            },
            get() {
              return this.all()[0] ?? null;
            },
          };
        },
      };
    },
    insert(table: { __table: symbol }) {
      return {
        values(values: HabitInsertValues) {
          return {
            returning() {
              return {
                get() {
                  if (table.__table !== HABITS) {
                    return null;
                  }

                  const inserted: OpenClawHabit = {
                    ...values,
                    createdAt: new Date("2026-03-12T00:00:00.000Z"),
                  };
                  state.habits.push(inserted);
                  return inserted;
                },
              };
            },
          };
        },
      };
    },
    update(table: { __table: symbol }) {
      return {
        set(values: Partial<HabitInsertValues>) {
          let condition: Condition | null = null;

          return {
            where(nextCondition: Condition) {
              condition = nextCondition;
              return this;
            },
            returning() {
              return {
                get() {
                  if (table.__table !== HABITS) {
                    return null;
                  }

                  const existing = state.habits.find((row) => matchesCondition(row, condition));
                  if (!existing) {
                    return null;
                  }

                  Object.assign(existing, values);
                  return existing;
                },
              };
            },
          };
        },
      };
    },
  };

  return db as unknown as DB;
}

describe("fetchCronJobs", () => {
  it("normalizes schedule strings and schedule objects from the gateway", async (t) => {
    t.mock.method(globalThis, "fetch", async () =>
      new Response(
        JSON.stringify([
          {
            id: "job-1",
            name: "String schedule",
            enabled: true,
            schedule: "0 * * * *",
          },
          {
            id: "job-2",
            name: "Object schedule",
            enabled: false,
            schedule: {
              every: "15m",
            },
            payload: {
              target: "main",
            },
          },
        ]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const jobs = await fetchCronJobs("https://gateway.example", "token");

    assert.equal(jobs[0]?.scheduleKind, "cron");
    assert.equal(jobs[0]?.scheduleExpr, "0 * * * *");
    assert.equal(jobs[0]?.scheduleRaw, JSON.stringify("0 * * * *"));
    assert.equal(jobs[1]?.scheduleKind, "every");
    assert.equal(jobs[1]?.scheduleExpr, "15m");
    assert.equal(jobs[1]?.sessionTarget, "main");
    assert.equal(jobs[1]?.scheduleRaw, JSON.stringify({ every: "15m" }));
  });
});

describe("upsertCronJobs", () => {
  it("updates existing cron jobs and inserts new ones using resolved agent mappings", () => {
    const state: FakeDbState = {
      habits: [
        {
          id: "habit-existing",
          connectionId: "conn-1",
          agentId: "agent-existing",
          externalId: "job-1",
          name: "Old name",
          type: "cron",
          schedule: JSON.stringify("0 0 * * *"),
          cronExpr: "0 0 * * *",
          scheduleKind: "cron",
          scheduleExpr: "0 0 * * *",
          sessionTarget: "main",
          trigger: "main",
          status: "active",
          enabled: true,
          lastRun: null,
          nextRun: null,
          lastSyncedAt: new Date("2026-03-10T00:00:00.000Z"),
          createdAt: new Date("2026-03-10T00:00:00.000Z"),
        },
      ],
      openclawAgents: [
        {
          connectionId: "conn-1",
          externalAgentId: "main",
          linkedAgentId: "agent-main",
          updatedAt: new Date("2026-03-12T00:00:00.000Z"),
        },
      ],
    };
    const db = createFakeDb(state);

    const rows = upsertCronJobs(db, "conn-1", [
      {
        id: "job-1",
        name: "Updated name",
        enabled: false,
        scheduleKind: "cron",
        scheduleExpr: "*/5 * * * *",
        scheduleRaw: JSON.stringify("*/5 * * * *"),
        sessionTarget: "main",
      },
      {
        id: "job-2",
        name: "Every fifteen minutes",
        enabled: true,
        scheduleKind: "every",
        scheduleExpr: "15m",
        scheduleRaw: JSON.stringify({ every: "15m" }),
        sessionTarget: "main",
      },
    ]);

    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.id, "habit-existing");
    assert.equal(rows[0]?.agentId, "agent-existing");
    assert.equal(rows[0]?.status, "paused");
    assert.equal(rows[0]?.cronExpr, "*/5 * * * *");
    assert.equal(rows[1]?.externalId, "job-2");
    assert.equal(rows[1]?.agentId, "agent-main");
    assert.equal(rows[1]?.type, "cron");
    assert.equal(rows[1]?.scheduleKind, "every");
    assert.equal(rows[1]?.cronExpr, null);
    assert.equal(rows[1]?.trigger, "main");
    assert.ok(rows[1]?.lastSyncedAt instanceof Date || false);
  });
});

describe("listCronJobs", () => {
  it("returns only habits with type cron for a connection", () => {
    const db = createFakeDb({
      habits: [
        {
          id: "habit-cron",
          connectionId: "conn-1",
          agentId: "agent-1",
          externalId: "job-1",
          name: "Cron job",
          type: "cron",
          schedule: JSON.stringify("0 * * * *"),
          cronExpr: "0 * * * *",
          scheduleKind: "cron",
          scheduleExpr: "0 * * * *",
          sessionTarget: "main",
          trigger: "main",
          status: "active",
          enabled: true,
          lastRun: null,
          nextRun: null,
          lastSyncedAt: new Date("2026-03-10T00:00:00.000Z"),
          createdAt: new Date("2026-03-12T00:00:00.000Z"),
        },
        {
          id: "habit-heartbeat",
          connectionId: "conn-1",
          agentId: "agent-1",
          externalId: null,
          name: "Heartbeat",
          type: "heartbeat",
          schedule: null,
          cronExpr: null,
          scheduleKind: null,
          scheduleExpr: null,
          sessionTarget: null,
          trigger: null,
          status: "active",
          enabled: true,
          lastRun: null,
          nextRun: null,
          lastSyncedAt: new Date("2026-03-10T00:00:00.000Z"),
          createdAt: new Date("2026-03-11T00:00:00.000Z"),
        },
      ],
      openclawAgents: [],
    });

    const rows = listCronJobs(db, { connectionId: "conn-1" });

    assert.deepEqual(rows.map((row) => row.id), ["habit-cron"]);
  });
});
