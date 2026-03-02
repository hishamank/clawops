import { eq, and, gte, lte, sum, count } from "drizzle-orm";
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

export function getTokenSummary(db: DB, filters: TokenFilters): TokenSummary {
  const conditions = [];

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
