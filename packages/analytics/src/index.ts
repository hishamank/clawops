import type { DB, UsageLog } from "@clawops/core";
import { usageLogs } from "@clawops/core";
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

  return rows[0]!;
}

// ── getTokenStats ───────────────────────────────────────────────────────────

export function getTokenStats(
  db: DB,
  filters?: TokenStatsFilters,
): TokenStats {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.agentId) {
    conditions.push("agent_id = ?");
    params.push(filters.agentId);
  }
  if (filters?.model) {
    conditions.push("model = ?");
    params.push(filters.model);
  }
  if (filters?.from) {
    conditions.push("created_at >= ?");
    params.push(Math.floor(filters.from.getTime() / 1000));
  }
  if (filters?.to) {
    conditions.push("created_at <= ?");
    params.push(Math.floor(filters.to.getTime() / 1000));
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `SELECT
    COALESCE(SUM(tokens_in), 0) AS totalTokensIn,
    COALESCE(SUM(tokens_out), 0) AS totalTokensOut,
    COALESCE(SUM(cost), 0) AS totalCost,
    COUNT(*) AS count
  FROM usage_logs ${where}`;

  const row = db.$client.prepare(query).get(...params) as TokenStats;
  return row;
}

// ── getCostByAgent ──────────────────────────────────────────────────────────

export function getCostByAgent(
  db: DB,
  from?: Date,
  to?: Date,
): CostByAgent[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (from) {
    conditions.push("created_at >= ?");
    params.push(Math.floor(from.getTime() / 1000));
  }
  if (to) {
    conditions.push("created_at <= ?");
    params.push(Math.floor(to.getTime() / 1000));
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `SELECT
    agent_id AS agentId,
    COALESCE(SUM(cost), 0) AS totalCost,
    COALESCE(SUM(tokens_in + tokens_out), 0) AS totalTokens
  FROM usage_logs ${where}
  GROUP BY agent_id
  ORDER BY totalCost DESC`;

  return db.$client.prepare(query).all(...params) as CostByAgent[];
}

// ── getCostByModel ──────────────────────────────────────────────────────────

export function getCostByModel(
  db: DB,
  from?: Date,
  to?: Date,
): CostByModel[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (from) {
    conditions.push("created_at >= ?");
    params.push(Math.floor(from.getTime() / 1000));
  }
  if (to) {
    conditions.push("created_at <= ?");
    params.push(Math.floor(to.getTime() / 1000));
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `SELECT
    model,
    COALESCE(SUM(cost), 0) AS totalCost,
    COALESCE(SUM(tokens_in + tokens_out), 0) AS totalTokens
  FROM usage_logs ${where}
  GROUP BY model
  ORDER BY totalCost DESC`;

  return db.$client.prepare(query).all(...params) as CostByModel[];
}

// ── getCostByProject ────────────────────────────────────────────────────────

export function getCostByProject(
  db: DB,
  from?: Date,
  to?: Date,
): CostByProject[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (from) {
    conditions.push("u.created_at >= ?");
    params.push(Math.floor(from.getTime() / 1000));
  }
  if (to) {
    conditions.push("u.created_at <= ?");
    params.push(Math.floor(to.getTime() / 1000));
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `SELECT
    t.project_id AS projectId,
    COALESCE(SUM(u.cost), 0) AS totalCost,
    COALESCE(SUM(u.tokens_in + u.tokens_out), 0) AS totalTokens
  FROM usage_logs u
  LEFT JOIN tasks t ON u.task_id = t.id
  ${where}
  GROUP BY t.project_id
  ORDER BY totalCost DESC`;

  return db.$client.prepare(query).all(...params) as CostByProject[];
}

// ── getDailySpend ───────────────────────────────────────────────────────────

export function getDailySpend(
  db: DB,
  from: Date,
  to: Date,
): DailySpend[] {
  const fromUnix = Math.floor(from.getTime() / 1000);
  const toUnix = Math.floor(to.getTime() / 1000);

  const query = `SELECT
    DATE(created_at, 'unixepoch') AS date,
    COALESCE(SUM(cost), 0) AS cost,
    COALESCE(SUM(tokens_in), 0) AS tokensIn,
    COALESCE(SUM(tokens_out), 0) AS tokensOut
  FROM usage_logs
  WHERE created_at >= ? AND created_at <= ?
  GROUP BY DATE(created_at, 'unixepoch')
  ORDER BY date ASC`;

  const rows = db.$client.prepare(query).all(fromUnix, toUnix) as DailySpend[];

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
