import { sql, eq, and, gte, lte, count, type SQL } from "drizzle-orm";
import type { DB, UsageLog } from "@clawops/core";
import { usageLogs, tasks } from "@clawops/core";
import { calcCost } from "@clawops/domain";

// ── Input types ─────────────────────────────────────────────────────────────

interface LogUsageInput {
  agentId: string;
  taskId?: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
}

interface TokenStatsFilters {
  agentId?: string;
  model?: string;
  from?: Date;
  to?: Date;
}

interface TokenStats {
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
  count: number;
}

interface CostByAgent {
  agentId: string;
  totalCost: number;
  totalTokens: number;
}

interface CostByModel {
  model: string;
  totalCost: number;
  totalTokens: number;
}

interface CostByProject {
  projectId: string | null;
  totalCost: number;
  totalTokens: number;
}

interface DailySpend {
  date: string;
  cost: number;
  tokensIn: number;
  tokensOut: number;
}

// ── logUsage ────────────────────────────────────────────────────────────────

export function logUsage(db: DB, input: LogUsageInput): UsageLog {
  const cost = calcCost(input.model, input.tokensIn, input.tokensOut);

  const rows = db
    .insert(usageLogs)
    .values({
      agentId: input.agentId,
      taskId: input.taskId ?? null,
      model: input.model,
      tokensIn: input.tokensIn,
      tokensOut: input.tokensOut,
      cost,
    })
    .returning()
    .all();

  if (rows.length === 0) throw new Error("Failed to insert usageLog");
  return rows[0];
}

// ── getTokenStats ───────────────────────────────────────────────────────────

export function getTokenStats(
  db: DB,
  filters?: TokenStatsFilters,
): TokenStats {
  const conditions: SQL[] = [];

  if (filters?.agentId) {
    conditions.push(eq(usageLogs.agentId, filters.agentId));
  }
  if (filters?.model) {
    conditions.push(eq(usageLogs.model, filters.model));
  }
  if (filters?.from) {
    conditions.push(gte(usageLogs.createdAt, filters.from));
  }
  if (filters?.to) {
    conditions.push(lte(usageLogs.createdAt, filters.to));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const row = db
    .select({
      totalTokensIn: sql<number>`COALESCE(SUM(${usageLogs.tokensIn}), 0)`,
      totalTokensOut: sql<number>`COALESCE(SUM(${usageLogs.tokensOut}), 0)`,
      totalCost: sql<number>`COALESCE(SUM(${usageLogs.cost}), 0)`,
      count: count(),
    })
    .from(usageLogs)
    .where(where)
    .get();

  return row ?? { totalTokensIn: 0, totalTokensOut: 0, totalCost: 0, count: 0 };
}

// ── getCostByAgent ──────────────────────────────────────────────────────────

export function getCostByAgent(
  db: DB,
  from?: Date,
  to?: Date,
): CostByAgent[] {
  const conditions: SQL[] = [];

  if (from) {
    conditions.push(gte(usageLogs.createdAt, from));
  }
  if (to) {
    conditions.push(lte(usageLogs.createdAt, to));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select({
      agentId: usageLogs.agentId,
      totalCost: sql<number>`COALESCE(SUM(${usageLogs.cost}), 0)`,
      totalTokens: sql<number>`COALESCE(SUM(${usageLogs.tokensIn} + ${usageLogs.tokensOut}), 0)`,
    })
    .from(usageLogs)
    .where(where)
    .groupBy(usageLogs.agentId)
    .orderBy(sql`SUM(${usageLogs.cost}) DESC`)
    .all();
}

// ── getCostByModel ──────────────────────────────────────────────────────────

export function getCostByModel(
  db: DB,
  from?: Date,
  to?: Date,
): CostByModel[] {
  const conditions: SQL[] = [];

  if (from) {
    conditions.push(gte(usageLogs.createdAt, from));
  }
  if (to) {
    conditions.push(lte(usageLogs.createdAt, to));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select({
      model: usageLogs.model,
      totalCost: sql<number>`COALESCE(SUM(${usageLogs.cost}), 0)`,
      totalTokens: sql<number>`COALESCE(SUM(${usageLogs.tokensIn} + ${usageLogs.tokensOut}), 0)`,
    })
    .from(usageLogs)
    .where(where)
    .groupBy(usageLogs.model)
    .orderBy(sql`SUM(${usageLogs.cost}) DESC`)
    .all();
}

// ── getCostByProject ────────────────────────────────────────────────────────

export function getCostByProject(
  db: DB,
  from?: Date,
  to?: Date,
): CostByProject[] {
  const conditions: SQL[] = [];

  if (from) {
    conditions.push(gte(usageLogs.createdAt, from));
  }
  if (to) {
    conditions.push(lte(usageLogs.createdAt, to));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select({
      projectId: tasks.projectId,
      totalCost: sql<number>`COALESCE(SUM(${usageLogs.cost}), 0)`,
      totalTokens: sql<number>`COALESCE(SUM(${usageLogs.tokensIn} + ${usageLogs.tokensOut}), 0)`,
    })
    .from(usageLogs)
    .leftJoin(tasks, eq(usageLogs.taskId, tasks.id))
    .where(where)
    .groupBy(tasks.projectId)
    .orderBy(sql`SUM(${usageLogs.cost}) DESC`)
    .all();
}

// ── getDailySpend ───────────────────────────────────────────────────────────

export function getDailySpend(
  db: DB,
  from: Date,
  to: Date,
): DailySpend[] {
  const rows = db
    .select({
      date: sql<string>`DATE(${usageLogs.createdAt}, 'unixepoch')`,
      cost: sql<number>`COALESCE(SUM(${usageLogs.cost}), 0)`,
      tokensIn: sql<number>`COALESCE(SUM(${usageLogs.tokensIn}), 0)`,
      tokensOut: sql<number>`COALESCE(SUM(${usageLogs.tokensOut}), 0)`,
    })
    .from(usageLogs)
    .where(and(gte(usageLogs.createdAt, from), lte(usageLogs.createdAt, to)))
    .groupBy(sql`DATE(${usageLogs.createdAt}, 'unixepoch')`)
    .orderBy(sql`DATE(${usageLogs.createdAt}, 'unixepoch') ASC`)
    .all();

  // Build a map of existing data
  const dataByDate = new Map<string, DailySpend>();
  for (const row of rows) {
    dataByDate.set(row.date, row);
  }

  // Fill in every day in the range
  const result: DailySpend[] = [];
  const current = new Date(from);
  current.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    const existing = dataByDate.get(dateStr);
    result.push(
      existing ?? { date: dateStr, cost: 0, tokensIn: 0, tokensOut: 0 },
    );
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
}
