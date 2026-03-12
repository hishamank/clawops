import crypto from "node:crypto";
import {
  and,
  desc,
  eq,
  habits,
  openclawAgents,
  openclawConnections,
  type DB,
  type Habit,
  type OpenClawConnection,
} from "@clawops/core";
import type { OpenClawConnection as ConnectionRecord } from "@clawops/core";

export interface OpenClawCronJob {
  id: string;
  name: string;
  enabled: boolean;
  scheduleKind: string | null;
  scheduleExpr: string | null;
  sessionTarget: string | null;
  scheduleRaw: string | null;
  lastRunAt?: Date | null;
  nextRunAt?: Date | null;
}

export interface UpdateCronJobPatch {
  enabled?: boolean;
  name?: string;
  schedule?: unknown;
  scheduleKind?: string | null;
  scheduleExpr?: string | null;
  sessionTarget?: string | null;
}

function coerceDate(value: unknown): Date | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value);
  }

  if (typeof value === "string" && value.length > 0) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return new Date(asNumber);
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function normalizeSchedule(rawSchedule: unknown): {
  kind: string | null;
  expr: string | null;
  raw: string | null;
} {
  if (rawSchedule == null) {
    return { kind: null, expr: null, raw: null };
  }

  if (typeof rawSchedule === "string") {
    return {
      kind: "cron",
      expr: rawSchedule,
      raw: JSON.stringify(rawSchedule),
    };
  }

  if (typeof rawSchedule !== "object" || Array.isArray(rawSchedule)) {
    return {
      kind: null,
      expr: String(rawSchedule),
      raw: JSON.stringify(rawSchedule),
    };
  }

  const schedule = rawSchedule as Record<string, unknown>;
  const kindCandidate = schedule["kind"] ?? schedule["type"] ?? schedule["mode"];
  const exprCandidate =
    schedule["expr"] ??
    schedule["expression"] ??
    schedule["cron"] ??
    schedule["value"] ??
    schedule["every"] ??
    schedule["at"];

  let inferredKind: string | null =
    typeof kindCandidate === "string" && kindCandidate.length > 0
      ? kindCandidate
      : null;

  if (!inferredKind) {
    if (typeof schedule["cron"] === "string") {
      inferredKind = "cron";
    } else if (typeof schedule["every"] === "string") {
      inferredKind = "every";
    } else if (typeof schedule["at"] === "string") {
      inferredKind = "at";
    }
  }

  return {
    kind: inferredKind,
    expr: typeof exprCandidate === "string" ? exprCandidate : null,
    raw: JSON.stringify(schedule),
  };
}

function normalizeCronJob(job: Record<string, unknown>): OpenClawCronJob {
  const schedule = normalizeSchedule(job["schedule"]);
  const payload =
    job["payload"] && typeof job["payload"] === "object" && !Array.isArray(job["payload"])
      ? (job["payload"] as Record<string, unknown>)
      : {};
  const state =
    job["state"] && typeof job["state"] === "object" && !Array.isArray(job["state"])
      ? (job["state"] as Record<string, unknown>)
      : {};

  return {
    id: String(job["id"] ?? ""),
    name: String(job["name"] ?? ""),
    enabled: Boolean(job["enabled"] ?? true),
    scheduleKind:
      typeof job["scheduleKind"] === "string" ? String(job["scheduleKind"]) : schedule.kind,
    scheduleExpr:
      typeof job["scheduleExpr"] === "string" ? String(job["scheduleExpr"]) : schedule.expr,
    sessionTarget:
      typeof job["sessionTarget"] === "string"
        ? String(job["sessionTarget"])
        : typeof payload["sessionTarget"] === "string"
          ? String(payload["sessionTarget"])
          : typeof payload["target"] === "string"
            ? String(payload["target"])
            : null,
    scheduleRaw: schedule.raw,
    lastRunAt:
      coerceDate(job["lastRunAt"]) ??
      coerceDate(state["lastRunAt"]) ??
      coerceDate(state["lastRunAtMs"]),
    nextRunAt:
      coerceDate(job["nextRunAt"]) ??
      coerceDate(state["nextRunAt"]) ??
      coerceDate(state["nextRunAtMs"]),
  };
}

function resolveGatewayToken(connection: OpenClawConnection, token?: string): string {
  const resolved = token ?? process.env["OPENCLAW_GATEWAY_TOKEN"];

  if (!resolved) {
    throw new Error(
      connection.hasGatewayToken
        ? "Gateway token is required to sync or update OpenClaw cron jobs"
        : "No gateway token available for OpenClaw cron job operation",
    );
  }

  return resolved;
}

function getConnectionOrThrow(db: DB, connectionId: string): ConnectionRecord {
  const connection = db
    .select()
    .from(openclawConnections)
    .where(eq(openclawConnections.id, connectionId))
    .get();

  if (!connection) {
    throw new Error(`OpenClaw connection "${connectionId}" not found`);
  }

  if (!connection.gatewayUrl) {
    throw new Error(`OpenClaw connection "${connectionId}" does not have a gateway URL`);
  }

  return connection;
}

function resolveAgentId(
  db: DB,
  connectionId: string,
  sessionTarget: string | null,
  existingAgentId: string | null,
): string {
  if (existingAgentId) {
    return existingAgentId;
  }

  const preferredTarget =
    sessionTarget && sessionTarget !== "isolated" ? sessionTarget : "main";
  const preferred =
    db
      .select()
      .from(openclawAgents)
      .where(
        and(
          eq(openclawAgents.connectionId, connectionId),
          eq(openclawAgents.externalAgentId, preferredTarget),
        ),
      )
      .get() ??
    db
      .select()
      .from(openclawAgents)
      .where(eq(openclawAgents.connectionId, connectionId))
      .orderBy(desc(openclawAgents.updatedAt))
      .get();

  if (!preferred) {
    throw new Error(
      `Cannot upsert cron jobs for connection "${connectionId}" before any OpenClaw agents are linked`,
    );
  }

  return preferred.linkedAgentId;
}

export async function fetchCronJobs(
  gatewayUrl: string,
  token: string,
): Promise<OpenClawCronJob[]> {
  const response = await fetch(`${gatewayUrl}/api/cron`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch cron jobs from OpenClaw gateway (${response.status})`);
  }

  const data = (await response.json()) as unknown;
  const jobs = Array.isArray(data)
    ? data
    : (data as { jobs?: unknown[] }).jobs ?? [];

  const normalized: OpenClawCronJob[] = [];

  for (const job of jobs) {
    if (!job || typeof job !== "object") {
      continue;
    }

    const record = job as Record<string, unknown>;
    const id = record["id"];
    const name = record["name"];

    if (typeof id !== "string" || id.trim() === "") {
      throw new Error("Received cron job with missing or empty id from OpenClaw gateway");
    }

    if (typeof name !== "string" || name.trim() === "") {
      throw new Error(`Received cron job with missing or empty name from OpenClaw gateway (id="${id}")`);
    }

    normalized.push(normalizeCronJob(record));
  }

  return normalized;
}

export function listCronJobs(
  db: DB,
  filters: {
    connectionId?: string;
  } = {},
): Habit[] {
  const query = db
    .select()
    .from(habits)
    .orderBy(desc(habits.createdAt));

  if (filters.connectionId) {
    return query
      .where(and(eq(habits.connectionId, filters.connectionId), eq(habits.type, "cron")))
      .all();
  }

  return query.where(eq(habits.type, "cron")).all();
}

export function getCronJob(db: DB, id: string): Habit | null {
  return db.select().from(habits).where(eq(habits.id, id)).get() ?? null;
}

export function upsertCronJobs(
  db: DB,
  connectionId: string,
  jobs: OpenClawCronJob[],
): Habit[] {
  const syncedAt = new Date();

  return db.transaction((tx) =>
    jobs.map((job) => {
      const existing = tx
        .select()
        .from(habits)
        .where(
          and(
            eq(habits.connectionId, connectionId),
            eq(habits.externalId, job.id),
          ),
        )
        .get();

      const agentId = resolveAgentId(tx as unknown as DB, connectionId, job.sessionTarget, existing?.agentId ?? null);
      const values = {
        connectionId,
        agentId,
        externalId: job.id,
        name: job.name,
        type: "cron" as const,
        schedule: job.scheduleRaw,
        cronExpr: job.scheduleKind === "cron" ? job.scheduleExpr : null,
        scheduleKind: job.scheduleKind,
        scheduleExpr: job.scheduleExpr,
        sessionTarget: job.sessionTarget,
        trigger: job.sessionTarget,
        status: job.enabled ? ("active" as const) : ("paused" as const),
        enabled: job.enabled,
        lastRun: job.lastRunAt ?? null,
        nextRun: job.nextRunAt ?? null,
        lastSyncedAt: syncedAt,
      };

      const row = existing
        ? tx
            .update(habits)
            .set(values)
            .where(eq(habits.id, existing.id))
            .returning()
            .get()
        : tx
            .insert(habits)
            .values({
              id: crypto.randomUUID(),
              ...values,
            })
            .returning()
            .get();

      return row;
    }),
  );
}

export async function updateCronJob(
  gatewayUrl: string,
  token: string,
  jobId: string,
  patch: UpdateCronJobPatch,
): Promise<OpenClawCronJob | null> {
  const response = await fetch(`${gatewayUrl}/api/cron/${jobId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to update OpenClaw cron job "${jobId}" (${response.status})`);
  }

  if (response.status === 204) {
    return null;
  }

  const data = (await response.json()) as unknown;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  return normalizeCronJob(data as Record<string, unknown>);
}

export async function syncCronJobs(
  db: DB,
  connection: OpenClawConnection,
  token?: string,
): Promise<Habit[]> {
  if (!connection.gatewayUrl) {
    throw new Error(`OpenClaw connection "${connection.id}" does not have a gateway URL`);
  }

  const jobs = await fetchCronJobs(
    connection.gatewayUrl,
    resolveGatewayToken(connection, token),
  );

  return upsertCronJobs(db, connection.id, jobs);
}

export function updateLocalCronJob(
  db: DB,
  id: string,
  updates: Partial<Pick<Habit, "name" | "schedule" | "cronExpr" | "scheduleKind" | "scheduleExpr" | "sessionTarget" | "enabled" | "status" | "lastSyncedAt">>,
): Habit {
  const updated = db
    .update(habits)
    .set(updates)
    .where(eq(habits.id, id))
    .returning()
    .get();

  if (!updated) {
    throw new Error(`Cron job "${id}" not found`);
  }

  return updated;
}

export async function updateConnectionCronJob(
  db: DB,
  localCronJobId: string,
  patch: UpdateCronJobPatch,
  token?: string,
): Promise<{ local: Habit; remote: OpenClawCronJob | null }> {
  const localJob = getCronJob(db, localCronJobId);
  if (!localJob) {
    throw new Error(`Cron job "${localCronJobId}" not found`);
  }

  if (!localJob.connectionId) {
    throw new Error(`Cron job "${localCronJobId}" is not linked to an OpenClaw connection`);
  }

  if (!localJob.externalId) {
    throw new Error(`Cron job "${localCronJobId}" is missing its external OpenClaw identity`);
  }

  const connection = getConnectionOrThrow(db, localJob.connectionId);
  const remote = await updateCronJob(
    connection.gatewayUrl as string,
    resolveGatewayToken(connection, token),
    localJob.externalId,
    patch,
  );

  const patchSchedule = patch.schedule !== undefined ? normalizeSchedule(patch.schedule) : null;
  const resolvedScheduleRaw = remote?.scheduleRaw ?? patchSchedule?.raw ?? localJob.schedule;
  const resolvedScheduleKind =
    remote?.scheduleKind ?? patch.scheduleKind ?? patchSchedule?.kind ?? localJob.scheduleKind;
  const resolvedScheduleExpr =
    remote?.scheduleExpr ?? patch.scheduleExpr ?? patchSchedule?.expr ?? localJob.scheduleExpr;
  const resolvedCronExpr =
    resolvedScheduleKind === "cron" ? resolvedScheduleExpr ?? localJob.cronExpr : null;

  const updatedLocal = updateLocalCronJob(db, localCronJobId, {
    name: remote?.name ?? patch.name ?? localJob.name,
    schedule: resolvedScheduleRaw,
    cronExpr: resolvedCronExpr,
    scheduleKind: resolvedScheduleKind,
    scheduleExpr: resolvedScheduleExpr,
    sessionTarget: remote?.sessionTarget ?? patch.sessionTarget ?? localJob.sessionTarget,
    enabled: remote?.enabled ?? patch.enabled ?? localJob.enabled,
    status:
      (remote?.enabled ?? patch.enabled ?? localJob.enabled)
        ? "active"
        : "paused",
    lastSyncedAt: new Date(),
  });

  return { local: updatedLocal, remote };
}
