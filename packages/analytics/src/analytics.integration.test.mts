import { describe, it } from "node:test";
import assert from "node:assert";
import type { DB } from "@clawops/core";

interface TimelineRow {
  timestamp: string;
  tokensIn?: number | string | null;
  tokensOut?: number | string | null;
  cost?: number | string | null;
  totalCost?: number | string | null;
  count?: number | null;
}

interface SelectChain<T> {
  from: () => SelectChain<T>;
  where: () => SelectChain<T>;
  groupBy: () => SelectChain<T>;
  orderBy: () => SelectChain<T>;
  all: () => T[];
}

function makeSelectChain<T>(rows: T[]): SelectChain<T> {
  const chain: SelectChain<T> = {
    from: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: () => chain,
    all: () => rows,
  };
  return chain;
}

function makeDb(rows: TimelineRow[]): DB {
  const db = {
    select: () => makeSelectChain(rows),
  };

  return db as unknown as DB;
}

const { getCostTimeline, getTokenTimeline } = await import("./index.js");

describe("analytics integration timelines", () => {
  it("groups token timeline rows into current ISO week buckets", () => {
    const points = getTokenTimeline(
      makeDb([
        {
          timestamp: "2025-01-06",
          tokensIn: "60",
          tokensOut: "30",
          cost: "0.6",
          count: 3,
        },
        {
          timestamp: "2025-01-13",
          tokensIn: "40",
          tokensOut: "20",
          cost: "0.4",
          count: 1,
        },
      ]),
      {
        agentId: "agent-1",
        from: new Date("2025-01-01T00:00:00Z"),
        to: new Date("2025-01-31T23:59:59Z"),
        granularity: "week",
      },
    );

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
    const points = getCostTimeline(
      makeDb([
        { timestamp: "2025-01-06", totalCost: "0.1", tokensIn: "10", tokensOut: "5", count: 1 },
        { timestamp: "2025-01-07", totalCost: "0.2", tokensIn: "20", tokensOut: "10", count: 1 },
        { timestamp: "2025-01-12", totalCost: "0.3", tokensIn: "30", tokensOut: "15", count: 1 },
        { timestamp: "2025-01-13", totalCost: "0.4", tokensIn: "40", tokensOut: "20", count: 1 },
      ]),
      {
        agentId: "agent-1",
        model: "gpt-4",
        from: new Date("2025-01-01T00:00:00Z"),
        to: new Date("2025-01-31T23:59:59Z"),
        granularity: "day",
      },
    );

    assert.deepStrictEqual(points, [
      { timestamp: "2025-01-06", totalCost: 0.1, tokensIn: 10, tokensOut: 5, count: 1 },
      { timestamp: "2025-01-07", totalCost: 0.2, tokensIn: 20, tokensOut: 10, count: 1 },
      { timestamp: "2025-01-12", totalCost: 0.3, tokensIn: 30, tokensOut: 15, count: 1 },
      { timestamp: "2025-01-13", totalCost: 0.4, tokensIn: 40, tokensOut: 20, count: 1 },
    ]);
  });
});
