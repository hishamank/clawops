import { before, describe, it } from "node:test";
import assert from "node:assert";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import type { DB } from "@clawops/core";
import * as schema from "@clawops/core";

const { getCostTimeline, getTokenTimeline } = await import("./index.js");

let db: DB;

before(() => {
  const sqlite = new Database(":memory:");
  db = drizzle(sqlite, { schema }) as unknown as DB;
  migrate(db as never, {
    migrationsFolder: path.resolve(process.cwd(), "../core/migrations"),
  });

  db.insert(schema.agents)
    .values([
      { id: "agent-1", name: "Agent 1", model: "gpt-4", role: "worker" },
      { id: "agent-2", name: "Agent 2", model: "claude", role: "worker" },
    ])
    .run();

  db.insert(schema.usageLogs)
    .values([
      {
        agentId: "agent-1",
        model: "gpt-4",
        tokensIn: 10,
        tokensOut: 5,
        cost: 0.1,
        createdAt: new Date("2025-01-06T10:15:00Z"),
      },
      {
        agentId: "agent-1",
        model: "gpt-4",
        tokensIn: 20,
        tokensOut: 10,
        cost: 0.2,
        createdAt: new Date("2025-01-07T09:30:00Z"),
      },
      {
        agentId: "agent-1",
        model: "gpt-4",
        tokensIn: 30,
        tokensOut: 15,
        cost: 0.3,
        createdAt: new Date("2025-01-12T18:45:00Z"),
      },
      {
        agentId: "agent-1",
        model: "gpt-4",
        tokensIn: 40,
        tokensOut: 20,
        cost: 0.4,
        createdAt: new Date("2025-01-13T08:00:00Z"),
      },
      {
        agentId: "agent-2",
        model: "claude",
        tokensIn: 99,
        tokensOut: 77,
        cost: 0.9,
        createdAt: new Date("2025-01-08T12:00:00Z"),
      },
    ])
    .run();
});

describe("analytics integration timelines", () => {
  it("groups token timeline rows into current ISO week buckets", () => {
    const points = getTokenTimeline(db, {
      agentId: "agent-1",
      from: new Date("2025-01-01T00:00:00Z"),
      to: new Date("2025-01-31T23:59:59Z"),
      granularity: "week",
    });

    assert.deepStrictEqual(points, [
      {
        timestamp: "2025-01-06",
        tokensIn: 60,
        tokensOut: 30,
        cost: 0.6,
        count: 3,
      },
      {
        timestamp: "2025-01-13",
        tokensIn: 40,
        tokensOut: 20,
        cost: 0.4,
        count: 1,
      },
    ]);
  });

  it("filters cost timeline by agent/model and preserves chronological ordering", () => {
    const points = getCostTimeline(db, {
      agentId: "agent-1",
      model: "gpt-4",
      from: new Date("2025-01-01T00:00:00Z"),
      to: new Date("2025-01-31T23:59:59Z"),
      granularity: "day",
    });

    assert.deepStrictEqual(points, [
      { timestamp: "2025-01-06", totalCost: 0.1, tokensIn: 10, tokensOut: 5, count: 1 },
      { timestamp: "2025-01-07", totalCost: 0.2, tokensIn: 20, tokensOut: 10, count: 1 },
      { timestamp: "2025-01-12", totalCost: 0.3, tokensIn: 30, tokensOut: 15, count: 1 },
      { timestamp: "2025-01-13", totalCost: 0.4, tokensIn: 40, tokensOut: 20, count: 1 },
    ]);
  });
});
