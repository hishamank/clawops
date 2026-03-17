import { eq, and, gte, lte, sum, count, sql, type SQL } from "drizzle-orm";
import type { DBOrTx } from "@clawops/core";
import { usageLogs, tasks, taskTemplates } from "@clawops/core";

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
export function getTokenSummary(db: DBOrTx, filters: TokenFilters): TokenSummary {
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
export function getCostsByAgent(db: DBOrTx): CostByGroup[] {
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
export function getCostsByModel(db: DBOrTx): CostByGroup[] {
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
export function getCostsByProject(db: DBOrTx): CostByGroup[] {
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

// ── Time-series types ──────────────────────────────────────────────────────

export type Granularity = "hour" | "day" | "week" | "month";

export interface TimelineFilters {
  agentId?: string;
  model?: string;
  from: Date;
  to: Date;
  granularity?: Granularity;
}

export interface TimelinePoint {
  timestamp: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  count: number;
}

export interface CostTimelinePoint {
  timestamp: string;
  totalCost: number;
  tokensIn: number;
  tokensOut: number;
  count: number;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatBucketDateUtc(date: Date, granularity: Granularity): string {
  const year = date.getUTCFullYear();
  const month = padDatePart(date.getUTCMonth() + 1);
  const day = padDatePart(date.getUTCDate());

  switch (granularity) {
    case "hour":
      return `${year}-${month}-${day} ${padDatePart(date.getUTCHours())}:00:00`;
    case "day":
      return `${year}-${month}-${day}`;
    case "week": {
      const weekStart = new Date(date);
      const dayOfWeek = weekStart.getUTCDay();
      const offset = (dayOfWeek + 6) % 7;
      weekStart.setUTCDate(weekStart.getUTCDate() - offset);
      return `${weekStart.getUTCFullYear()}-${padDatePart(weekStart.getUTCMonth() + 1)}-${padDatePart(weekStart.getUTCDate())}`;
    }
    case "month":
      return `${year}-${month}-01`;
  }
}

// ── Time-series aggregations ───────────────────────────────────────────────

/**
 * Build a SQL expression for truncating timestamps to the specified granularity.
 *
 * SQLite uses strftime for date formatting.
 */
function truncateToGranularity(granularity: Granularity): SQL {
  switch (granularity) {
    case "hour":
      return sql`strftime('%Y-%m-%d %H:00:00', datetime(${usageLogs.createdAt}, 'unixepoch'))`;
    case "day":
      return sql`strftime('%Y-%m-%d', datetime(${usageLogs.createdAt}, 'unixepoch'))`;
    case "week":
      // Week: truncate to Monday of the current week (ISO week start = Monday).
      return sql`strftime('%Y-%m-%d', datetime(${usageLogs.createdAt}, 'unixepoch', printf('-%d days', (CAST(strftime('%w', datetime(${usageLogs.createdAt}, 'unixepoch')) AS integer) + 6) % 7)))`;
    case "month":
      return sql`strftime('%Y-%m-01', datetime(${usageLogs.createdAt}, 'unixepoch'))`;
  }
}

/**
 * Get token usage timeline grouped by granularity.
 *
 * Returns time-series data for token consumption over a date range.
 *
 * @param db - Drizzle database handle.
 * @param filters - Filters including required date range and optional granularity (default: "day").
 * @returns Array of timeline points ordered by timestamp.
 */
export function getTokenTimeline(
  db: DBOrTx,
  filters: TimelineFilters,
): TimelinePoint[] {
  const { from, to, granularity = "day" } = filters;
  const conditions: SQL[] = [
    gte(usageLogs.createdAt, from),
    lte(usageLogs.createdAt, to),
  ];

  if (filters.agentId) {
    conditions.push(eq(usageLogs.agentId, filters.agentId));
  }
  if (filters.model) {
    conditions.push(eq(usageLogs.model, filters.model));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const timeBucket = truncateToGranularity(granularity);

  const rows = db
    .select({
      timestamp: timeBucket,
      tokensIn: sum(usageLogs.tokensIn),
      tokensOut: sum(usageLogs.tokensOut),
      cost: sum(usageLogs.cost),
      count: count(),
    })
    .from(usageLogs)
    .where(where)
    .groupBy(timeBucket)
    .orderBy(timeBucket)
    .all();

  return rows.map((r) => ({
    timestamp: r.timestamp as string,
    tokensIn: Number(r.tokensIn ?? 0),
    tokensOut: Number(r.tokensOut ?? 0),
    cost: Number(r.cost ?? 0),
    count: r.count ?? 0,
  }));
}

/**
 * Get cost timeline grouped by granularity.
 *
 * Returns time-series data for cost accumulation over a date range.
 *
 * @param db - Drizzle database handle.
 * @param filters - Filters including required date range and optional granularity (default: "day").
 * @returns Array of cost timeline points ordered by timestamp.
 */
export function getCostTimeline(
  db: DBOrTx,
  filters: TimelineFilters,
): CostTimelinePoint[] {
  const { from, to, granularity = "day" } = filters;
  const conditions: SQL[] = [
    gte(usageLogs.createdAt, from),
    lte(usageLogs.createdAt, to),
  ];

  if (filters.agentId) {
    conditions.push(eq(usageLogs.agentId, filters.agentId));
  }
  if (filters.model) {
    conditions.push(eq(usageLogs.model, filters.model));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const timeBucket = truncateToGranularity(granularity);

  const rows = db
    .select({
      timestamp: timeBucket,
      totalCost: sum(usageLogs.cost),
      tokensIn: sum(usageLogs.tokensIn),
      tokensOut: sum(usageLogs.tokensOut),
      count: count(),
    })
    .from(usageLogs)
    .where(where)
    .groupBy(timeBucket)
    .orderBy(timeBucket)
    .all();

  return rows.map((r) => ({
    timestamp: r.timestamp as string,
    totalCost: Number(r.totalCost ?? 0),
    tokensIn: Number(r.tokensIn ?? 0),
    tokensOut: Number(r.tokensOut ?? 0),
    count: r.count ?? 0,
  }));
}

// ── Template breakdown ─────────────────────────────────────────────────────

interface CostByTemplate {
  templateId: string;
  templateName: string | null;
  totalCost: number;
  totalIn: number;
  totalOut: number;
  count: number;
}

export function getCostsByTemplate(db: DBOrTx): CostByTemplate[] {
  const rows = db
    .select({
      templateId: tasks.templateId,
      templateName: taskTemplates.name,
      totalCost: sum(usageLogs.cost),
      totalIn: sum(usageLogs.tokensIn),
      totalOut: sum(usageLogs.tokensOut),
      count: count(),
    })
    .from(usageLogs)
    .innerJoin(tasks, eq(usageLogs.taskId, tasks.id))
    .leftJoin(taskTemplates, eq(tasks.templateId, taskTemplates.id))
    .groupBy(tasks.templateId, taskTemplates.name)
    .all();

  return rows.map((r) => ({
    templateId: r.templateId ?? "untagged",
    templateName: r.templateName,
    totalCost: Number(r.totalCost ?? 0),
    totalIn: Number(r.totalIn ?? 0),
    totalOut: Number(r.totalOut ?? 0),
    count: r.count,
  }));
}

export function getTokensByTemplate(db: DBOrTx): CostByTemplate[] {
  return getCostsByTemplate(db);
}
