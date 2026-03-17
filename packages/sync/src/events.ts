import crypto from "node:crypto";
import { getAgentByOpenClawIdentity, updateAgentStatus } from "@clawops/agents";
import {
  activityEvents,
  and,
  createActivityEvent,
  eq,
  events,
  habits,
  openclawConnections,
  openclawSessions,
  parseJsonObject,
  toJsonObject,
  type ActivityEvent,
  type DBOrTx,
  type Event,
  type Habit,
  type OpenClawConnection,
  type OpenClawSession,
} from "@clawops/core";
import { AgentStatus } from "@clawops/domain";
import { logHabitRun, logHeartbeat } from "@clawops/habits";

type SupportedInboundType =
  | "agent.heartbeat"
  | "session.started"
  | "session.ended"
  | "cron.run.completed";

export interface OpenClawInboundEventBase {
  eventId: string;
  type: SupportedInboundType;
  source: "hook" | "plugin";
  connectionId: string;
  occurredAt: Date;
  rawPayload: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface OpenClawAgentHeartbeatEvent extends OpenClawInboundEventBase {
  type: "agent.heartbeat";
  agentExternalId: string;
}

export interface OpenClawSessionStartedEvent extends OpenClawInboundEventBase {
  type: "session.started";
  sessionKey: string;
  sessionStartedAt: Date;
  sessionModel: string | null;
  sessionMetadata: Record<string, unknown> | null;
  agentExternalId: string | null;
}

export interface OpenClawSessionEndedEvent extends OpenClawInboundEventBase {
  type: "session.ended";
  sessionKey: string;
  sessionEndedAt: Date;
  sessionModel: string | null;
  sessionMetadata: Record<string, unknown> | null;
  agentExternalId: string | null;
}

export interface OpenClawCronRunCompletedEvent extends OpenClawInboundEventBase {
  type: "cron.run.completed";
  cronExternalId: string;
  cronName: string | null;
  success: boolean;
  note: string | null;
  ranAt: Date;
}

export type NormalizedOpenClawInboundEvent =
  | OpenClawAgentHeartbeatEvent
  | OpenClawSessionStartedEvent
  | OpenClawSessionEndedEvent
  | OpenClawCronRunCompletedEvent;

export interface OpenClawInboundEventIngestResult {
  normalizedEvent: NormalizedOpenClawInboundEvent;
  lowLevelEvent: Event;
  activityEvent: ActivityEvent;
  connection: OpenClawConnection;
  stateChanges: string[];
}

export class OpenClawInboundEventValidationError extends Error {
  code = "VALIDATION_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "OpenClawInboundEventValidationError";
  }
}

export class OpenClawInboundEventProcessingError extends Error {
  code:
    | "OPENCLAW_CONNECTION_NOT_FOUND"
    | "OPENCLAW_AGENT_NOT_LINKED"
    | "OPENCLAW_CRON_JOB_NOT_FOUND";

  constructor(
    code:
      | "OPENCLAW_CONNECTION_NOT_FOUND"
      | "OPENCLAW_AGENT_NOT_LINKED"
      | "OPENCLAW_CRON_JOB_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "OpenClawInboundEventProcessingError";
    this.code = code;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function pickBoolean(...values: unknown[]): boolean | null {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return value !== 0;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "ok", "success"].includes(normalized)) {
        return true;
      }
      if (["false", "0", "no", "failed", "error"].includes(normalized)) {
        return false;
      }
    }
  }

  return null;
}

function pickDate(...values: unknown[]): Date | null {
  for (const value of values) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      const candidate = new Date(value > 1_000_000_000_000 ? value : value * 1000);
      if (!Number.isNaN(candidate.getTime())) {
        return candidate;
      }
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        continue;
      }

      const numeric = Number(trimmed);
      if (!Number.isNaN(numeric)) {
        const candidate = new Date(numeric > 1_000_000_000_000 ? numeric : numeric * 1000);
        if (!Number.isNaN(candidate.getTime())) {
          return candidate;
        }
      }

      const candidate = new Date(trimmed);
      if (!Number.isNaN(candidate.getTime())) {
        return candidate;
      }
    }
  }

  return null;
}

function requireString(value: string | null, field: string): string {
  if (!value) {
    throw new OpenClawInboundEventValidationError(`Missing required field: ${field}`);
  }

  return value;
}

function normalizeMetadata(
  root: Record<string, unknown>,
  fallback: Record<string, unknown>,
): Record<string, unknown> {
  const explicitMetadata = asRecord(root["metadata"]);
  const payload = asRecord(root["payload"]);

  return {
    ...explicitMetadata,
    ...fallback,
    payload,
  };
}

function resolveType(root: Record<string, unknown>): SupportedInboundType {
  const rawType = pickString(root["type"], root["eventType"], root["name"], root["event"]);

  switch (rawType) {
    case "agent.heartbeat":
    case "session.started":
    case "session.ended":
    case "cron.run.completed":
      return rawType;
    default:
      throw new OpenClawInboundEventValidationError(
        `Unsupported OpenClaw event type${rawType ? `: ${rawType}` : ""}`,
      );
  }
}

export function normalizeOpenClawInboundEvent(
  input: unknown,
): NormalizedOpenClawInboundEvent {
  const root = asRecord(input);
  if (Object.keys(root).length === 0) {
    throw new OpenClawInboundEventValidationError("Request body must be a JSON object");
  }

  const type = resolveType(root);
  const source = pickString(root["source"]) === "plugin" ? "plugin" : "hook";
  const connectionId = requireString(
    pickString(root["connectionId"], asRecord(root["connection"])["id"]),
    "connectionId",
  );
  const occurredAt =
    pickDate(root["occurredAt"], root["timestamp"], root["createdAt"]) ?? new Date();
  const eventId = pickString(root["eventId"], root["id"]) ?? crypto.randomUUID();
  const metadataRoot = {
    eventId,
    source,
    occurredAt: occurredAt.toISOString(),
  };

  if (type === "agent.heartbeat") {
    const agent = asRecord(root["agent"]);
    const agentExternalId = requireString(
      pickString(root["agentExternalId"], root["agentId"], agent["externalId"], agent["id"]),
      "agent.externalId",
    );

    return {
      eventId,
      type,
      source,
      connectionId,
      occurredAt,
      agentExternalId,
      rawPayload: root,
      metadata: normalizeMetadata(root, {
        ...metadataRoot,
        agentExternalId,
      }),
    };
  }

  if (type === "session.started" || type === "session.ended") {
    const session = asRecord(root["session"]);
    const agent = asRecord(root["agent"]);
    const sessionKey = requireString(
      pickString(root["sessionKey"], session["key"], session["sessionKey"], session["id"]),
      "session.key",
    );
    const sessionModel = pickString(root["model"], session["model"]);
    const sessionMetadata = Object.keys(session).length > 0 ? session : null;
    const agentExternalId = pickString(
      root["agentExternalId"],
      root["agentId"],
      session["agentExternalId"],
      session["agentId"],
      agent["externalId"],
      agent["id"],
    );

    if (type === "session.started") {
      const sessionStartedAt =
        pickDate(
          session["startedAt"],
          session["started_at"],
          root["startedAt"],
          occurredAt,
        ) ?? occurredAt;

      return {
        eventId,
        type,
        source,
        connectionId,
        occurredAt,
        sessionKey,
        sessionStartedAt,
        sessionModel,
        sessionMetadata,
        agentExternalId,
        rawPayload: root,
        metadata: normalizeMetadata(root, {
          ...metadataRoot,
          sessionKey,
          agentExternalId,
        }),
      };
    }

    const sessionEndedAt =
      pickDate(
        session["endedAt"],
        session["ended_at"],
        root["endedAt"],
        occurredAt,
      ) ?? occurredAt;

    return {
      eventId,
      type,
      source,
      connectionId,
      occurredAt,
      sessionKey,
      sessionEndedAt,
      sessionModel,
      sessionMetadata,
      agentExternalId,
      rawPayload: root,
      metadata: normalizeMetadata(root, {
        ...metadataRoot,
        sessionKey,
        agentExternalId,
      }),
    };
  }

  const cron = asRecord(root["cron"]);
  const run = asRecord(root["run"]);
  const cronExternalId = requireString(
    pickString(root["cronExternalId"], cron["externalId"], cron["id"]),
    "cron.externalId",
  );
  const cronName = pickString(root["cronName"], cron["name"]);
  const success = pickBoolean(root["success"], run["success"], run["status"]) ?? true;
  const note = pickString(root["note"], run["note"], run["message"]);
  const ranAt = pickDate(root["ranAt"], run["ranAt"], run["completedAt"], occurredAt) ?? occurredAt;

  return {
    eventId,
    type,
    source,
    connectionId,
    occurredAt,
    cronExternalId,
    cronName,
    success,
    note,
    ranAt,
    rawPayload: root,
    metadata: normalizeMetadata(root, {
      ...metadataRoot,
      cronExternalId,
      cronName,
      success,
    }),
  };
}

function requireConnection(db: DBOrTx, connectionId: string): OpenClawConnection {
  const connection = db
    .select()
    .from(openclawConnections)
    .where(eq(openclawConnections.id, connectionId))
    .get();

  if (!connection) {
    throw new OpenClawInboundEventProcessingError(
      "OPENCLAW_CONNECTION_NOT_FOUND",
      `OpenClaw connection "${connectionId}" not found`,
    );
  }

  return connection;
}

function insertLowLevelEvent(
  db: DBOrTx,
  input: {
    occurredAt: Date;
    agentId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    meta: Record<string, unknown>;
  },
): Event {
  const row = db
    .insert(events)
    .values({
      action: input.action,
      agentId: input.agentId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      meta: toJsonObject(input.meta),
      createdAt: input.occurredAt,
    })
    .returning()
    .get();

  if (!row) {
    throw new Error("Failed to write inbound OpenClaw event");
  }

  return row;
}

function recordActivity(
  db: DBOrTx,
  input: {
    occurredAt: Date;
    type: string;
    title: string;
    severity?: "info" | "warning" | "error" | "critical";
    agentId?: string | null;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
    body?: string | null;
  },
): ActivityEvent {
  const row = createActivityEvent(db, {
    source: "hook",
    severity: input.severity ?? "info",
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    agentId: input.agentId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: toJsonObject(input.metadata),
  });

  if (row.createdAt.getTime() !== input.occurredAt.getTime()) {
    const [updated] = db
      .update(activityEvents)
      .set({ createdAt: input.occurredAt })
      .where(eq(activityEvents.id, row.id))
      .returning()
      .all();

    return updated ?? row;
  }

  return row;
}

function requireMappedAgent(
  db: DBOrTx,
  connectionId: string,
  externalAgentId: string,
) {
  const agent = getAgentByOpenClawIdentity(db, {
    connectionId,
    externalAgentId,
  });

  if (!agent) {
    throw new OpenClawInboundEventProcessingError(
      "OPENCLAW_AGENT_NOT_LINKED",
      `OpenClaw agent "${externalAgentId}" is not linked for connection "${connectionId}"`,
    );
  }

  return agent;
}

function upsertOpenClawSessionState(
  db: DBOrTx,
  input: {
    connectionId: string;
    sessionKey: string;
    agentId: string | null;
    model: string | null;
    status: "active" | "ended";
    startedAt: Date;
    endedAt: Date | null;
    metadata: Record<string, unknown> | null;
    occurredAt: Date;
  },
): OpenClawSession {
  const now = input.occurredAt;
  const serializedMetadata = input.metadata ? toJsonObject(input.metadata) : null;

  if (input.status === "active") {
    const existing = db
      .select()
      .from(openclawSessions)
      .where(
        and(
          eq(openclawSessions.connectionId, input.connectionId),
          eq(openclawSessions.sessionKey, input.sessionKey),
        ),
      )
      .get();

    if (existing?.status === "ended" && existing.endedAt) {
      return existing;
    }

    return db
      .insert(openclawSessions)
      .values({
        connectionId: input.connectionId,
        sessionKey: input.sessionKey,
        agentId: input.agentId,
        model: input.model,
        status: "active",
        startedAt: input.startedAt,
        endedAt: null,
        metadata: serializedMetadata,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [openclawSessions.connectionId, openclawSessions.sessionKey],
        set: {
          agentId: input.agentId,
          model: input.model,
          status: "active",
          startedAt: input.startedAt,
          endedAt: null,
          metadata: serializedMetadata,
          updatedAt: now,
        },
      })
      .returning()
      .get();
  }

  const existing = db
    .select()
    .from(openclawSessions)
    .where(
      and(
        eq(openclawSessions.connectionId, input.connectionId),
        eq(openclawSessions.sessionKey, input.sessionKey),
      ),
    )
    .get();

  if (!existing) {
    const inserted = db
      .insert(openclawSessions)
      .values({
        connectionId: input.connectionId,
        sessionKey: input.sessionKey,
        agentId: input.agentId,
        model: input.model,
        status: "ended",
        startedAt: input.startedAt,
        endedAt: input.endedAt ?? now,
        metadata: serializedMetadata,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    if (!inserted) {
      throw new Error(`Failed to create ended session "${input.sessionKey}"`);
    }

    return inserted;
  }

  const updated = db
    .update(openclawSessions)
    .set({
      agentId: input.agentId ?? existing.agentId,
      model: input.model ?? existing.model,
      status: "ended",
      endedAt: input.endedAt ?? now,
      metadata: serializedMetadata ?? existing.metadata,
      updatedAt: now,
    })
    .where(eq(openclawSessions.id, existing.id))
    .returning()
    .get();

  if (!updated) {
    throw new Error(`Failed to update session "${input.sessionKey}"`);
  }

  return updated;
}

function requireCronJob(
  db: DBOrTx,
  connectionId: string,
  externalId: string,
): Habit {
  const cron = db
    .select()
    .from(habits)
    .where(
      and(
        eq(habits.connectionId, connectionId),
        eq(habits.externalId, externalId),
        eq(habits.type, "cron"),
      ),
    )
    .get();

  if (!cron) {
    throw new OpenClawInboundEventProcessingError(
      "OPENCLAW_CRON_JOB_NOT_FOUND",
      `OpenClaw cron job "${externalId}" is not synced for connection "${connectionId}"`,
    );
  }

  return cron;
}

function ingestOpenClawInboundEventTx(
  db: DBOrTx,
  normalizedEvent: NormalizedOpenClawInboundEvent,
): OpenClawInboundEventIngestResult {
  const connection = requireConnection(db, normalizedEvent.connectionId);
  const stateChanges: string[] = [];

  if (normalizedEvent.type === "agent.heartbeat") {
    const agent = requireMappedAgent(
      db,
      normalizedEvent.connectionId,
      normalizedEvent.agentExternalId,
    );
    const heartbeatRun = logHeartbeat(db, agent.id);
    updateAgentStatus(db, agent.id, AgentStatus.online);
    stateChanges.push("agent.heartbeat", "agent.status.online");

    const lowLevelEvent = insertLowLevelEvent(db, {
      occurredAt: normalizedEvent.occurredAt,
      agentId: agent.id,
      action: "openclaw.agent.heartbeat",
      entityType: "agent",
      entityId: agent.id,
      meta: {
        connectionId: connection.id,
        eventId: normalizedEvent.eventId,
        externalAgentId: normalizedEvent.agentExternalId,
        heartbeatRunId: heartbeatRun.id,
        rawPayload: normalizedEvent.rawPayload,
      },
    });
    const activityEvent = recordActivity(db, {
      occurredAt: normalizedEvent.occurredAt,
      type: "openclaw.agent.heartbeat",
      title: `Heartbeat received from ${agent.name}`,
      agentId: agent.id,
      entityType: "agent",
      entityId: agent.id,
      metadata: {
        connectionId: connection.id,
        eventId: normalizedEvent.eventId,
        externalAgentId: normalizedEvent.agentExternalId,
        heartbeatRunId: heartbeatRun.id,
        rawPayload: normalizedEvent.rawPayload,
      },
    });

    return {
      normalizedEvent,
      lowLevelEvent,
      activityEvent,
      connection,
      stateChanges,
    };
  }

  if (normalizedEvent.type === "session.started") {
    const agent = normalizedEvent.agentExternalId
      ? requireMappedAgent(db, normalizedEvent.connectionId, normalizedEvent.agentExternalId)
      : null;
    const session = upsertOpenClawSessionState(db, {
      connectionId: normalizedEvent.connectionId,
      sessionKey: normalizedEvent.sessionKey,
      agentId: agent?.id ?? null,
      model: normalizedEvent.sessionModel,
      status: "active",
      startedAt: normalizedEvent.sessionStartedAt,
      endedAt: null,
      metadata: normalizedEvent.sessionMetadata,
      occurredAt: normalizedEvent.occurredAt,
    });
    stateChanges.push("openclaw_session.active");

    if (agent) {
      updateAgentStatus(db, agent.id, AgentStatus.online);
      stateChanges.push("agent.status.online");
    }

    const lowLevelEvent = insertLowLevelEvent(db, {
      occurredAt: normalizedEvent.occurredAt,
      agentId: agent?.id ?? null,
      action: "openclaw.session.started",
      entityType: "openclaw_session",
      entityId: session.id,
      meta: {
        connectionId: connection.id,
        eventId: normalizedEvent.eventId,
        sessionKey: normalizedEvent.sessionKey,
        externalAgentId: normalizedEvent.agentExternalId,
        rawPayload: normalizedEvent.rawPayload,
      },
    });
    const activityEvent = recordActivity(db, {
      occurredAt: normalizedEvent.occurredAt,
      type: "openclaw.session.started",
      title: `OpenClaw session started: ${normalizedEvent.sessionKey}`,
      agentId: agent?.id ?? null,
      entityType: "openclaw_session",
      entityId: session.id,
      metadata: {
        connectionId: connection.id,
        eventId: normalizedEvent.eventId,
        sessionKey: normalizedEvent.sessionKey,
        externalAgentId: normalizedEvent.agentExternalId,
        rawPayload: normalizedEvent.rawPayload,
      },
    });

    return {
      normalizedEvent,
      lowLevelEvent,
      activityEvent,
      connection,
      stateChanges,
    };
  }

  if (normalizedEvent.type === "session.ended") {
    const agent = normalizedEvent.agentExternalId
      ? requireMappedAgent(db, normalizedEvent.connectionId, normalizedEvent.agentExternalId)
      : null;
    const existing = db
      .select()
      .from(openclawSessions)
      .where(
        and(
          eq(openclawSessions.connectionId, normalizedEvent.connectionId),
          eq(openclawSessions.sessionKey, normalizedEvent.sessionKey),
        ),
      )
      .get();
    const session = upsertOpenClawSessionState(db, {
      connectionId: normalizedEvent.connectionId,
      sessionKey: normalizedEvent.sessionKey,
      agentId: agent?.id ?? existing?.agentId ?? null,
      model: normalizedEvent.sessionModel ?? existing?.model ?? null,
      status: "ended",
      startedAt: existing?.startedAt ?? normalizedEvent.sessionEndedAt,
      endedAt: normalizedEvent.sessionEndedAt,
      metadata:
        normalizedEvent.sessionMetadata ??
        (existing?.metadata ? parseJsonObject(existing.metadata) : null),
      occurredAt: normalizedEvent.occurredAt,
    });
    stateChanges.push("openclaw_session.ended");

    const lowLevelEvent = insertLowLevelEvent(db, {
      occurredAt: normalizedEvent.occurredAt,
      agentId: agent?.id ?? existing?.agentId ?? null,
      action: "openclaw.session.ended",
      entityType: "openclaw_session",
      entityId: session.id,
      meta: {
        connectionId: connection.id,
        eventId: normalizedEvent.eventId,
        sessionKey: normalizedEvent.sessionKey,
        externalAgentId: normalizedEvent.agentExternalId,
        rawPayload: normalizedEvent.rawPayload,
      },
    });
    const activityEvent = recordActivity(db, {
      occurredAt: normalizedEvent.occurredAt,
      type: "openclaw.session.ended",
      title: `OpenClaw session ended: ${normalizedEvent.sessionKey}`,
      agentId: agent?.id ?? existing?.agentId ?? null,
      entityType: "openclaw_session",
      entityId: session.id,
      metadata: {
        connectionId: connection.id,
        eventId: normalizedEvent.eventId,
        sessionKey: normalizedEvent.sessionKey,
        externalAgentId: normalizedEvent.agentExternalId,
        rawPayload: normalizedEvent.rawPayload,
      },
    });

    return {
      normalizedEvent,
      lowLevelEvent,
      activityEvent,
      connection,
      stateChanges,
    };
  }

  const cron = requireCronJob(db, normalizedEvent.connectionId, normalizedEvent.cronExternalId);
  const run = logHabitRun(db, cron.id, cron.agentId, {
    success: normalizedEvent.success,
    note: normalizedEvent.note ?? undefined,
    ranAt: normalizedEvent.ranAt,
  });
  stateChanges.push("cron_run.recorded", "habit.last_run.updated");

  const lowLevelEvent = insertLowLevelEvent(db, {
    occurredAt: normalizedEvent.occurredAt,
    agentId: cron.agentId,
    action: "openclaw.cron.run.completed",
    entityType: "habit",
    entityId: cron.id,
    meta: {
      connectionId: connection.id,
      eventId: normalizedEvent.eventId,
      externalCronId: normalizedEvent.cronExternalId,
      habitRunId: run.id,
      success: normalizedEvent.success,
      note: normalizedEvent.note,
      rawPayload: normalizedEvent.rawPayload,
    },
  });
  const activityEvent = recordActivity(db, {
    occurredAt: normalizedEvent.occurredAt,
    type: "openclaw.cron.run.completed",
    title: normalizedEvent.success
      ? `Cron run completed: ${cron.name}`
      : `Cron run failed: ${cron.name}`,
    severity: normalizedEvent.success ? "info" : "warning",
    agentId: cron.agentId,
    entityType: "habit",
    entityId: cron.id,
    metadata: {
      connectionId: connection.id,
      eventId: normalizedEvent.eventId,
      externalCronId: normalizedEvent.cronExternalId,
      habitRunId: run.id,
      success: normalizedEvent.success,
      note: normalizedEvent.note,
      rawPayload: normalizedEvent.rawPayload,
    },
    body: normalizedEvent.note,
  });

  return {
    normalizedEvent,
    lowLevelEvent,
    activityEvent,
    connection,
    stateChanges,
  };
}

export function ingestOpenClawInboundEvent(
  db: DBOrTx,
  input: unknown,
): OpenClawInboundEventIngestResult {
  const normalizedEvent = normalizeOpenClawInboundEvent(input);

  return db.transaction((tx) =>
    ingestOpenClawInboundEventTx(tx, normalizedEvent),
  );
}
