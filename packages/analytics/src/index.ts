import { eq, and, gte, lte, sum, count, type SQL } from "drizzle-orm";
import type { DB } from "@clawops/core";
import { usageLogs, tasks } from "@clawops/core";

// ── Token aggregation ──────────────────────────────────────────────────────

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

/**
 * Aggregate token usage and cost across usage logs.
 *
 * Builds a dynamic WHERE clause from the supplied filters (agentId, model,
 * date range) and returns summed totals for tokens in/out, cost, and row count.
 *
 * @param db - Drizzle database handle.
 * @param filters - Optional filters to narrow the aggregation.
 * @returns A summary with `totalIn`, `totalOut`, `totalCost`, and `count`.
 */
export function getTokenSummary(db: DB, filters: TokenFilters): TokenSummary {
  const conditions: SQL[] = [];

  if (filters.agentId) {
    conditions.push(eq(usageLogs.agentId, filters.agentId));
  }
  if (filters.model) {
    conditions.push(eq(usageLogs.model, filters.model));
  }
  if (filters.from) {
    conditions.push(gte(usageLogs.createdAt, filters.from));
  }
  if (filters.to) {
    conditions.push(lte(usageLogs.createdAt, filters.to));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const result = db
    .select({
      totalIn: sum(usageLogs.tokensIn),
      totalOut: sum(usageLogs.tokensOut),
      totalCost: sum(usageLogs.cost),
      count: count(),
    })
    .from(usageLogs)
    .where(where)
    .get();

  return {
    totalIn: Number(result?.totalIn ?? 0),
    totalOut: Number(result?.totalOut ?? 0),
    totalCost: Number(result?.totalCost ?? 0),
    count: result?.count ?? 0,
  };
}

// ── Cost aggregation ───────────────────────────────────────────────────────

interface CostByGroup {
  group: string;
  totalCost: number;
  totalIn: number;
  totalOut: number;
  count: number;
}

/**
 * Aggregate usage costs grouped by agent ID.
 *
 * @param db - Drizzle database handle.
 * @returns An array of cost summaries, one per agent.
 */
export function getCostsByAgent(db: DB): CostByGroup[] {
  const rows = db
    .select({
      group: usageLogs.agentId,
      totalCost: sum(usageLogs.cost),
      totalIn: sum(usageLogs.tokensIn),
      totalOut: sum(usageLogs.tokensOut),
      count: count(),
    })
    .from(usageLogs)
    .groupBy(usageLogs.agentId)
    .all();

  return rows.map((r) => ({
    group: r.group,
    totalCost: Number(r.totalCost ?? 0),
    totalIn: Number(r.totalIn ?? 0),
    totalOut: Number(r.totalOut ?? 0),
    count: r.count,
  }));
}

/**
 * Aggregate usage costs grouped by model name.
 *
 * @param db - Drizzle database handle.
 * @returns An array of cost summaries, one per model.
 */
export function getCostsByModel(db: DB): CostByGroup[] {
  const rows = db
    .select({
      group: usageLogs.model,
      totalCost: sum(usageLogs.cost),
      totalIn: sum(usageLogs.tokensIn),
      totalOut: sum(usageLogs.tokensOut),
      count: count(),
    })
    .from(usageLogs)
    .groupBy(usageLogs.model)
    .all();

  return rows.map((r) => ({
    group: r.group,
    totalCost: Number(r.totalCost ?? 0),
    totalIn: Number(r.totalIn ?? 0),
    totalOut: Number(r.totalOut ?? 0),
    count: r.count,
  }));
}

/**
 * Aggregate usage costs grouped by project ID (via a join on tasks).
 *
 * Usage logs without an associated task/project are grouped as `"unassigned"`.
 *
 * @param db - Drizzle database handle.
 * @returns An array of cost summaries, one per project.
 */
export function getCostsByProject(db: DB): CostByGroup[] {
  const rows = db
    .select({
      group: tasks.projectId,
      totalCost: sum(usageLogs.cost),
      totalIn: sum(usageLogs.tokensIn),
      totalOut: sum(usageLogs.tokensOut),
      count: count(),
    })
    .from(usageLogs)
    .innerJoin(tasks, eq(usageLogs.taskId, tasks.id))
    .groupBy(tasks.projectId)
    .all();

  return rows.map((r) => ({
    group: r.group ?? "unassigned",
    totalCost: Number(r.totalCost ?? 0),
    totalIn: Number(r.totalIn ?? 0),
    totalOut: Number(r.totalOut ?? 0),
    count: r.count,
  }));
}
