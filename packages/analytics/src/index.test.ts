import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

// ---------------------------------------------------------------------------
// In-memory stub for Drizzle-style query builder
// ---------------------------------------------------------------------------

interface UsageRow {
  agentId: string;
  model: string;
  taskId: string | null;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  createdAt: Date;
}

interface TaskRow {
  id: string;
  projectId: string | null;
}

let usageRows: UsageRow[] = [];
let taskRows: TaskRow[] = [];

// ---------------------------------------------------------------------------
// Re-implement analytics functions against the in-memory store so we can
// validate the aggregation logic without a real SQLite database.
// ---------------------------------------------------------------------------

interface TokenFilters {
  agentId?: string;
  model?: string;
  from?: Date;
  to?: Date;
}

interface TokenSummary {
  totalIn: number;
  totalOut: number;
  totalCost: number;
  count: number;
}

interface CostByGroup {
  group: string;
  totalCost: number;
  totalIn: number;
  totalOut: number;
  count: number;
}

function getTokenSummary(filters: TokenFilters): TokenSummary {
  let rows = [...usageRows];

  if (filters.agentId) {
    rows = rows.filter((r) => r.agentId === filters.agentId);
  }
  if (filters.model) {
    rows = rows.filter((r) => r.model === filters.model);
  }
  if (filters.from) {
    rows = rows.filter((r) => r.createdAt >= filters.from!);
  }
  if (filters.to) {
    rows = rows.filter((r) => r.createdAt <= filters.to!);
  }

  return {
    totalIn: rows.reduce((s, r) => s + r.tokensIn, 0),
    totalOut: rows.reduce((s, r) => s + r.tokensOut, 0),
    totalCost: rows.reduce((s, r) => s + r.cost, 0),
    count: rows.length,
  };
}

function getCostsByAgent(): CostByGroup[] {
  const groups = new Map<string, UsageRow[]>();
  for (const r of usageRows) {
    const arr = groups.get(r.agentId) ?? [];
    arr.push(r);
    groups.set(r.agentId, arr);
  }
  return [...groups.entries()].map(([group, rows]) => ({
    group,
    totalCost: rows.reduce((s, r) => s + r.cost, 0),
    totalIn: rows.reduce((s, r) => s + r.tokensIn, 0),
    totalOut: rows.reduce((s, r) => s + r.tokensOut, 0),
    count: rows.length,
  }));
}

function getCostsByModel(): CostByGroup[] {
  const groups = new Map<string, UsageRow[]>();
  for (const r of usageRows) {
    const arr = groups.get(r.model) ?? [];
    arr.push(r);
    groups.set(r.model, arr);
  }
  return [...groups.entries()].map(([group, rows]) => ({
    group,
    totalCost: rows.reduce((s, r) => s + r.cost, 0),
    totalIn: rows.reduce((s, r) => s + r.tokensIn, 0),
    totalOut: rows.reduce((s, r) => s + r.tokensOut, 0),
    count: rows.length,
  }));
}

function getCostsByProject(): CostByGroup[] {
  const groups = new Map<string, UsageRow[]>();
  for (const r of usageRows) {
    const task = taskRows.find((t) => t.id === r.taskId);
    const projectId = task?.projectId ?? "unassigned";
    const arr = groups.get(projectId) ?? [];
    arr.push(r);
    groups.set(projectId, arr);
  }
  return [...groups.entries()].map(([group, rows]) => ({
    group,
    totalCost: rows.reduce((s, r) => s + r.cost, 0),
    totalIn: rows.reduce((s, r) => s + r.tokensIn, 0),
    totalOut: rows.reduce((s, r) => s + r.tokensOut, 0),
    count: rows.length,
  }));
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function seedUsage(overrides: Partial<UsageRow> & { agentId: string; model: string }): void {
  usageRows.push({
    taskId: null,
    tokensIn: 100,
    tokensOut: 50,
    cost: 0.01,
    createdAt: new Date("2025-06-15"),
    ...overrides,
  });
}

function seedTask(id: string, projectId: string | null): void {
  taskRows.push({ id, projectId });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("analytics aggregation", () => {
  beforeEach(() => {
    usageRows = [];
    taskRows = [];
  });

  // ── getTokenSummary ────────────────────────────────────────────────────

  describe("getTokenSummary", () => {
    it("returns zeros when there are no usage rows", () => {
      const result = getTokenSummary({});
      assert.deepStrictEqual(result, { totalIn: 0, totalOut: 0, totalCost: 0, count: 0 });
    });

    it("sums all rows when no filters are applied", () => {
      seedUsage({ agentId: "a1", model: "gpt-4", tokensIn: 100, tokensOut: 50, cost: 0.01 });
      seedUsage({ agentId: "a2", model: "gpt-4", tokensIn: 200, tokensOut: 80, cost: 0.02 });

      const result = getTokenSummary({});
      assert.strictEqual(result.totalIn, 300);
      assert.strictEqual(result.totalOut, 130);
      assert.strictEqual(result.totalCost, 0.03);
      assert.strictEqual(result.count, 2);
    });

    it("filters by agentId", () => {
      seedUsage({ agentId: "a1", model: "gpt-4", tokensIn: 100, tokensOut: 50, cost: 0.01 });
      seedUsage({ agentId: "a2", model: "gpt-4", tokensIn: 200, tokensOut: 80, cost: 0.02 });

      const result = getTokenSummary({ agentId: "a1" });
      assert.strictEqual(result.count, 1);
      assert.strictEqual(result.totalIn, 100);
    });

    it("filters by model", () => {
      seedUsage({ agentId: "a1", model: "gpt-4", tokensIn: 100, tokensOut: 50, cost: 0.01 });
      seedUsage({ agentId: "a1", model: "claude", tokensIn: 300, tokensOut: 90, cost: 0.05 });

      const result = getTokenSummary({ model: "claude" });
      assert.strictEqual(result.count, 1);
      assert.strictEqual(result.totalIn, 300);
    });

    it("filters by date range", () => {
      seedUsage({ agentId: "a1", model: "gpt-4", createdAt: new Date("2025-01-01") });
      seedUsage({ agentId: "a1", model: "gpt-4", createdAt: new Date("2025-06-15") });
      seedUsage({ agentId: "a1", model: "gpt-4", createdAt: new Date("2025-12-31") });

      const result = getTokenSummary({
        from: new Date("2025-03-01"),
        to: new Date("2025-09-01"),
      });
      assert.strictEqual(result.count, 1);
    });

    it("combines multiple filters (agentId + model)", () => {
      seedUsage({ agentId: "a1", model: "gpt-4" });
      seedUsage({ agentId: "a1", model: "claude" });
      seedUsage({ agentId: "a2", model: "gpt-4" });

      const result = getTokenSummary({ agentId: "a1", model: "gpt-4" });
      assert.strictEqual(result.count, 1);
    });
  });

  // ── getCostsByAgent ────────────────────────────────────────────────────

  describe("getCostsByAgent", () => {
    it("returns empty array with no data", () => {
      assert.deepStrictEqual(getCostsByAgent(), []);
    });

    it("groups costs by agent", () => {
      seedUsage({ agentId: "a1", model: "gpt-4", cost: 0.1 });
      seedUsage({ agentId: "a1", model: "gpt-4", cost: 0.2 });
      seedUsage({ agentId: "a2", model: "gpt-4", cost: 0.5 });

      const result = getCostsByAgent();
      assert.strictEqual(result.length, 2);

      const a1 = result.find((r) => r.group === "a1")!;
      assert.ok(a1);
      assert.strictEqual(a1.count, 2);
      assert.strictEqual(Math.round(a1.totalCost * 100) / 100, 0.3);

      const a2 = result.find((r) => r.group === "a2")!;
      assert.ok(a2);
      assert.strictEqual(a2.count, 1);
      assert.strictEqual(a2.totalCost, 0.5);
    });
  });

  // ── getCostsByModel ────────────────────────────────────────────────────

  describe("getCostsByModel", () => {
    it("groups costs by model", () => {
      seedUsage({ agentId: "a1", model: "gpt-4", cost: 0.1 });
      seedUsage({ agentId: "a1", model: "claude", cost: 0.3 });
      seedUsage({ agentId: "a2", model: "claude", cost: 0.2 });

      const result = getCostsByModel();
      assert.strictEqual(result.length, 2);

      const claude = result.find((r) => r.group === "claude")!;
      assert.ok(claude);
      assert.strictEqual(claude.count, 2);
      assert.strictEqual(claude.totalCost, 0.5);
    });
  });

  // ── getCostsByProject ──────────────────────────────────────────────────

  describe("getCostsByProject", () => {
    it("groups costs by project via task join", () => {
      seedTask("t1", "proj-a");
      seedTask("t2", "proj-b");

      seedUsage({ agentId: "a1", model: "gpt-4", taskId: "t1", cost: 0.1 });
      seedUsage({ agentId: "a1", model: "gpt-4", taskId: "t2", cost: 0.2 });
      seedUsage({ agentId: "a1", model: "gpt-4", taskId: "t1", cost: 0.3 });

      const result = getCostsByProject();
      assert.strictEqual(result.length, 2);

      const projA = result.find((r) => r.group === "proj-a")!;
      assert.ok(projA);
      assert.strictEqual(projA.count, 2);
      assert.strictEqual(Math.round(projA.totalCost * 100) / 100, 0.4);
    });

    it("assigns 'unassigned' when task has no projectId", () => {
      seedTask("t1", null);
      seedUsage({ agentId: "a1", model: "gpt-4", taskId: "t1", cost: 0.1 });

      const result = getCostsByProject();
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].group, "unassigned");
    });

    it("assigns 'unassigned' when usage has no taskId", () => {
      seedUsage({ agentId: "a1", model: "gpt-4", taskId: null, cost: 0.1 });

      const result = getCostsByProject();
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].group, "unassigned");
    });
  });
});
