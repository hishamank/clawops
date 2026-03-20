import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq, and, gte, lte, sum, count, sql, type SQL, or } from "drizzle-orm";
import type { DBOrTx } from "@clawops/core";
import { agents, openclawSessionUsageEntries } from "@clawops/core";

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
 * Aggregate imported OpenClaw token usage and cost.
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
    conditions.push(eq(openclawSessionUsageEntries.linkedAgentId, filters.agentId));
  }
  if (filters.model) {
    conditions.push(or(
      eq(openclawSessionUsageEntries.model, filters.model),
      eq(openclawSessionUsageEntries.modelAlias, filters.model),
    ) as SQL);
  }
  if (filters.from) {
    conditions.push(gte(openclawSessionUsageEntries.eventTimestamp, filters.from));
  }
  if (filters.to) {
    conditions.push(lte(openclawSessionUsageEntries.eventTimestamp, filters.to));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const result = db
    .select({
      totalIn: sum(openclawSessionUsageEntries.tokensIn),
      totalOut: sum(openclawSessionUsageEntries.tokensOut),
      totalCost: sum(openclawSessionUsageEntries.cost),
      count: count(),
    })
    .from(openclawSessionUsageEntries)
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
  const groupExpr = sql<string>`coalesce(${agents.name}, ${openclawSessionUsageEntries.externalAgentName}, ${openclawSessionUsageEntries.externalAgentId}, 'unknown')`;
  const rows = db
    .select({
      group: groupExpr,
      totalCost: sum(openclawSessionUsageEntries.cost),
      totalIn: sum(openclawSessionUsageEntries.tokensIn),
      totalOut: sum(openclawSessionUsageEntries.tokensOut),
      count: count(),
    })
    .from(openclawSessionUsageEntries)
    .leftJoin(agents, eq(openclawSessionUsageEntries.linkedAgentId, agents.id))
    .groupBy(groupExpr)
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
  const groupExpr = sql<string>`coalesce(${openclawSessionUsageEntries.modelAlias}, ${openclawSessionUsageEntries.model})`;
  const rows = db
    .select({
      group: groupExpr,
      totalCost: sum(openclawSessionUsageEntries.cost),
      totalIn: sum(openclawSessionUsageEntries.tokensIn),
      totalOut: sum(openclawSessionUsageEntries.tokensOut),
      count: count(),
    })
    .from(openclawSessionUsageEntries)
    .groupBy(groupExpr)
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
 * @param db - Drizzle database handle.
 * @returns An array of cost summaries, one per project.
 */
export function getCostsByProject(_db: DBOrTx): CostByGroup[] {
  return [];
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
      return sql`strftime('%Y-%m-%d %H:00:00', datetime(${openclawSessionUsageEntries.eventTimestamp}, 'unixepoch'))`;
    case "day":
      return sql`strftime('%Y-%m-%d', datetime(${openclawSessionUsageEntries.eventTimestamp}, 'unixepoch'))`;
    case "week":
      // Week: truncate to Monday of the current week (ISO week start = Monday).
      return sql`strftime('%Y-%m-%d', datetime(${openclawSessionUsageEntries.eventTimestamp}, 'unixepoch', printf('-%d days', (CAST(strftime('%w', datetime(${openclawSessionUsageEntries.eventTimestamp}, 'unixepoch')) AS integer) + 6) % 7)))`;
    case "month":
      return sql`strftime('%Y-%m-01', datetime(${openclawSessionUsageEntries.eventTimestamp}, 'unixepoch'))`;
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
    gte(openclawSessionUsageEntries.eventTimestamp, from),
    lte(openclawSessionUsageEntries.eventTimestamp, to),
  ];

  if (filters.agentId) {
    conditions.push(eq(openclawSessionUsageEntries.linkedAgentId, filters.agentId));
  }
  if (filters.model) {
    conditions.push(or(
      eq(openclawSessionUsageEntries.model, filters.model),
      eq(openclawSessionUsageEntries.modelAlias, filters.model),
    ) as SQL);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const timeBucket = truncateToGranularity(granularity);

  const rows = db
    .select({
      timestamp: timeBucket,
      tokensIn: sum(openclawSessionUsageEntries.tokensIn),
      tokensOut: sum(openclawSessionUsageEntries.tokensOut),
      cost: sum(openclawSessionUsageEntries.cost),
      count: count(),
    })
    .from(openclawSessionUsageEntries)
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
    gte(openclawSessionUsageEntries.eventTimestamp, from),
    lte(openclawSessionUsageEntries.eventTimestamp, to),
  ];

  if (filters.agentId) {
    conditions.push(eq(openclawSessionUsageEntries.linkedAgentId, filters.agentId));
  }
  if (filters.model) {
    conditions.push(or(
      eq(openclawSessionUsageEntries.model, filters.model),
      eq(openclawSessionUsageEntries.modelAlias, filters.model),
    ) as SQL);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const timeBucket = truncateToGranularity(granularity);

  const rows = db
    .select({
      timestamp: timeBucket,
      totalCost: sum(openclawSessionUsageEntries.cost),
      tokensIn: sum(openclawSessionUsageEntries.tokensIn),
      tokensOut: sum(openclawSessionUsageEntries.tokensOut),
      count: count(),
    })
    .from(openclawSessionUsageEntries)
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

export function getCostsByTemplate(_db: DBOrTx): CostByTemplate[] {
  return [];
}

export function getTokensByTemplate(db: DBOrTx): CostByTemplate[] {
  return getCostsByTemplate(db);
}

// ── OpenClaw file-based usage reporting ────────────────────────────────────

const DEFAULT_IGNORE_PROVIDERS = new Set(["openclaw"]);
const DEFAULT_IGNORE_MODELS = new Set(["delivery-mirror"]);

export interface OpenClawUsageReportOptions {
  agentsDir?: string;
  hours?: number;
  ignoreProviders?: string[];
  ignoreModels?: string[];
  topAgents?: number;
  topProviders?: number;
  now?: Date;
}

export interface OpenClawAgentUsage {
  agentId: string;
  totalTokens: number;
  cost: number;
  messages: number;
  topModel: string | null;
  models: Array<{ model: string; count: number }>;
  providers: Array<{ provider: string; count: number }>;
}

export interface OpenClawProviderUsage {
  provider: string;
  tokens: number;
  messages: number;
  cost: number;
}

export interface OpenClawUsageReport {
  hours: number;
  agentsDir: string;
  cutoff: Date;
  totalTokens: number;
  totalMessages: number;
  totalCost: number;
  topAgents: OpenClawAgentUsage[];
  topProviders: OpenClawProviderUsage[];
}

interface OpenClawUsageAccumulator {
  totalTokens: number;
  cost: number;
  messages: number;
  models: Map<string, number>;
  providers: Map<string, number>;
}

function resolveHomePath(inputPath: string): string {
  if (inputPath === "~") {
    return os.homedir();
  }
  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
}

function parseOpenClawTimestamp(timestamp: unknown): Date | null {
  if (typeof timestamp !== "string") {
    return null;
  }

  const normalized = timestamp.endsWith("Z") ? timestamp : `${timestamp}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function formatUsageNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

export function formatUsageCost(value: number): string {
  if (value >= 1) {
    return `$${value.toFixed(2)}`;
  }
  if (value > 0) {
    return `$${value.toFixed(3)}`;
  }
  return "$0";
}

export function shortenProvider(provider: string): string {
  const mapping: Record<string, string> = {
    "openai-codex": "codex",
    openrouter: "or",
    anthropic: "anth",
    llamacpp: "local",
    groq: "groq",
    google: "google",
    nvidia: "nvidia",
  };

  return mapping[provider] ?? provider;
}

export function shortenModel(model: string): string {
  if (model === "openrouter/free") {
    return "or-free";
  }

  let result = model;
  if (result.includes("/")) {
    result = result.slice(result.indexOf("/") + 1);
  }

  return result
    .replace(":free", "")
    .replace("google/", "")
    .replace("openai/", "")
    .replace("anthropic/", "")
    .replace("meta-llama/", "")
    .replace("arcee-ai/", "");
}

function listSessionFiles(agentsDir: string): string[] {
  try {
    const agentEntries = fs.readdirSync(agentsDir, { withFileTypes: true });
    return agentEntries.flatMap((entry) => {
      if (!entry.isDirectory()) {
        return [];
      }

      const sessionsDir = path.join(agentsDir, entry.name, "sessions");
      try {
        return fs
          .readdirSync(sessionsDir, { withFileTypes: true })
          .filter((file) => file.isFile() && file.name.endsWith(".jsonl"))
          .map((file) => path.join(sessionsDir, file.name));
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

function createUsageAccumulator(): OpenClawUsageAccumulator {
  return {
    totalTokens: 0,
    cost: 0,
    messages: 0,
    models: new Map<string, number>(),
    providers: new Map<string, number>(),
  };
}

function incrementCounter(counter: Map<string, number>, key: string): void {
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

function sortUsageEntries(entries: Map<string, number>): Array<{ key: string; count: number }> {
  return [...entries.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

export function getOpenClawUsageReport(
  options: OpenClawUsageReportOptions = {},
): OpenClawUsageReport {
  const hours = options.hours ?? 1;
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);
  const agentsDir = resolveHomePath(options.agentsDir ?? "~/.openclaw/agents");
  const ignoreProviders = new Set(options.ignoreProviders ?? [...DEFAULT_IGNORE_PROVIDERS]);
  const ignoreModels = new Set(options.ignoreModels ?? [...DEFAULT_IGNORE_MODELS]);

  const usageByAgent = new Map<string, OpenClawUsageAccumulator>();
  const providerTotals = new Map<string, OpenClawProviderUsage>();

  for (const filePath of listSessionFiles(agentsDir)) {
    try {
      const stat = fs.statSync(filePath);
      if (stat.mtime.getTime() < cutoff.getTime()) {
        continue;
      }

      const agentId = path.basename(path.dirname(path.dirname(filePath)));
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.split("\n");

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        let entry: Record<string, unknown>;
        try {
          entry = JSON.parse(line) as Record<string, unknown>;
        } catch {
          continue;
        }

        if (entry["type"] !== "message") {
          continue;
        }

        const timestamp = parseOpenClawTimestamp(entry["timestamp"]);
        if (!timestamp || timestamp < cutoff) {
          continue;
        }

        const message = entry["message"];
        if (!message || typeof message !== "object" || Array.isArray(message)) {
          continue;
        }

        const messageRecord = message as Record<string, unknown>;
        const usage = messageRecord["usage"];
        const usageRecord =
          usage && typeof usage === "object" && !Array.isArray(usage)
            ? (usage as Record<string, unknown>)
            : {};

        const provider = typeof messageRecord["provider"] === "string" ? messageRecord["provider"] : "unknown";
        const model = typeof messageRecord["model"] === "string" ? messageRecord["model"] : "unknown";

        if (ignoreProviders.has(provider) || ignoreModels.has(model)) {
          continue;
        }

        const input = toNumber(usageRecord["input"]);
        const output = toNumber(usageRecord["output"]);
        const cacheRead = toNumber(usageRecord["cacheRead"]);
        const cacheWrite = toNumber(usageRecord["cacheWrite"]);
        const totalTokens =
          toNumber(usageRecord["totalTokens"]) || input + output + cacheRead + cacheWrite;

        const costValue = usageRecord["cost"];
        const costRecord =
          costValue && typeof costValue === "object" && !Array.isArray(costValue)
            ? (costValue as Record<string, unknown>)
            : {};
        const cost = toNumber(costRecord["total"]);

        if (totalTokens === 0 && cost === 0) {
          continue;
        }

        const agentUsage = usageByAgent.get(agentId) ?? createUsageAccumulator();
        agentUsage.totalTokens += totalTokens;
        agentUsage.cost += cost;
        agentUsage.messages += 1;
        incrementCounter(agentUsage.models, model);
        incrementCounter(agentUsage.providers, provider);
        usageByAgent.set(agentId, agentUsage);

        const providerUsage = providerTotals.get(provider) ?? {
          provider,
          tokens: 0,
          messages: 0,
          cost: 0,
        };
        providerUsage.tokens += totalTokens;
        providerUsage.messages += 1;
        providerUsage.cost += cost;
        providerTotals.set(provider, providerUsage);
      }
    } catch {
      continue;
    }
  }

  const topAgents = [...usageByAgent.entries()]
    .map(([agentId, usage]) => {
      const sortedModels = sortUsageEntries(usage.models);
      const sortedProviders = sortUsageEntries(usage.providers);
      return {
        agentId,
        totalTokens: usage.totalTokens,
        cost: usage.cost,
        messages: usage.messages,
        topModel: sortedModels[0]?.key ?? null,
        models: sortedModels.map(({ key, count }) => ({ model: key, count })),
        providers: sortedProviders.map(({ key, count }) => ({ provider: key, count })),
      } satisfies OpenClawAgentUsage;
    })
    .sort((left, right) => right.totalTokens - left.totalTokens || left.agentId.localeCompare(right.agentId))
    .slice(0, options.topAgents ?? 5);

  const topProviders = [...providerTotals.values()]
    .sort((left, right) => right.tokens - left.tokens || left.provider.localeCompare(right.provider))
    .slice(0, options.topProviders ?? 4);

  return {
    hours,
    agentsDir,
    cutoff,
    totalTokens: [...usageByAgent.values()].reduce((sumValue, usage) => sumValue + usage.totalTokens, 0),
    totalMessages: [...usageByAgent.values()].reduce((sumValue, usage) => sumValue + usage.messages, 0),
    totalCost: [...usageByAgent.values()].reduce((sumValue, usage) => sumValue + usage.cost, 0),
    topAgents,
    topProviders,
  };
}

export function formatOpenClawUsageReport(report: OpenClawUsageReport): string {
  const displayHours = Number.isInteger(report.hours) ? String(report.hours) : String(report.hours);

  if (report.totalTokens === 0 && report.totalCost === 0) {
    return `No model usage in the last ${displayHours}h`;
  }

  const lines = [
    `Last ${displayHours}h: ${formatUsageNumber(report.totalTokens)} tok • ${report.totalMessages} msgs • ${formatUsageCost(report.totalCost)}`,
  ];

  if (report.topProviders.length > 0) {
    lines.push(
      `Providers: ${report.topProviders
        .map((provider) => `${shortenProvider(provider.provider)} ${formatUsageNumber(provider.tokens)} (${provider.messages})`)
        .join(" | ")}`,
    );
  }

  if (report.topAgents.length > 0) {
    lines.push("Top agents:");
    for (const agent of report.topAgents) {
      lines.push(
        `- ${agent.agentId}: ${formatUsageNumber(agent.totalTokens)} • ${agent.messages} msgs • ${formatUsageCost(agent.cost)} • ${agent.topModel ? shortenModel(agent.topModel) : "-"}`,
      );
    }
  }

  return lines.join("\n");
}
