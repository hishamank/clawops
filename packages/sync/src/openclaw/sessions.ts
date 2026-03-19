import {
  type SQL,
  agents,
  and,
  desc,
  eq,
  gte,
  inArray,
  openclawAgents,
  openclawSessions,
  sql,
  toJsonObject,
  parseJsonObject,
  type DBOrTx,
  type OpenClawConnection,
  type OpenClawSession,
} from "@clawops/core";
import { AgentStatus } from "@clawops/domain";

export type OpenClawSessionStatus = "active" | "ended";

export interface FetchedOpenClawSession {
  sessionKey: string;
  agentId: string | null;
  model: string | null;
  status: "active";
  startedAt: Date;
  endedAt: null;
  metadata: Record<string, unknown> | null;
}

export interface OpenClawSessionFilters {
  connectionId?: string;
  status?: OpenClawSessionStatus;
  limit?: number;
}

export type OpenClawSessionRecord = Omit<OpenClawSession, "metadata"> & {
  metadata: Record<string, unknown> | null;
};

export class OpenClawSessionFetchError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "OpenClawSessionFetchError";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
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
      const date = new Date(value > 1_000_000_000_000 ? value : value * 1000);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }

    if (typeof value === "string" && value.trim()) {
      const trimmed = value.trim();
      const numeric = Number(trimmed);
      if (!Number.isNaN(numeric)) {
        const date = new Date(numeric > 1_000_000_000_000 ? numeric : numeric * 1000);
        if (!Number.isNaN(date.getTime())) {
          return date;
        }
      }

      const date = new Date(trimmed);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
  }

  return null;
}

export function normalizeSession(input: unknown): FetchedOpenClawSession | null {
  const session = asRecord(input);
  const payload = asRecord(session["payload"]);
  const state = asRecord(session["state"]);

  const sessionKey = pickString(
    session["sessionKey"],
    session["session_key"],
    session["key"],
    session["id"],
  );

  if (!sessionKey) {
    return null;
  }

  return {
    sessionKey,
    agentId: pickString(
      session["agentId"],
      session["agent_id"],
      payload["agentId"],
      payload["agent_id"],
    ),
    model: pickString(
      session["model"],
      payload["model"],
      state["model"],
    ),
    status: "active",
    startedAt:
      pickDate(
        session["startedAt"],
        session["started_at"],
        session["createdAt"],
        session["created_at"],
        session["connectedAt"],
        session["connected_at"],
        state["startedAt"],
        state["started_at"],
      ) ?? new Date(),
    endedAt: null,
    metadata: Object.keys(session).length > 0 ? session : null,
  };
}

function parseGatewaySessions(data: unknown): FetchedOpenClawSession[] {
  const root = asRecord(data);
  const sessions = Array.isArray(data)
    ? data
    : Array.isArray(root["sessions"])
      ? root["sessions"]
      : [];

  return sessions
    .map((session) => normalizeSession(session))
    .filter((session): session is FetchedOpenClawSession => session !== null);
}

function resolveGatewayToken(connection: OpenClawConnection, tokenOverride?: string): string {
  const token = tokenOverride?.trim() || process.env["OPENCLAW_GATEWAY_TOKEN"]?.trim();

  if (connection.hasGatewayToken && !token) {
    throw new Error(
      `OPENCLAW_GATEWAY_TOKEN is required to sync sessions for connection ${connection.id}`,
    );
  }

  return token ?? "";
}

function deserializeSession(session: OpenClawSession): OpenClawSessionRecord {
  return {
    ...session,
    metadata: session.metadata ? parseJsonObject(session.metadata) : null,
  };
}

export async function fetchActiveSessions(
  gatewayUrl: string,
  token: string,
): Promise<FetchedOpenClawSession[]> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${gatewayUrl}/api/sessions`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new OpenClawSessionFetchError(
        `Failed to fetch OpenClaw sessions from ${gatewayUrl}: ${res.status} ${res.statusText}`,
      );
    }

    const data = (await res.json()) as unknown;
    return parseGatewaySessions(data);
  } catch (error) {
    if (error instanceof OpenClawSessionFetchError) {
      throw error;
    }

    throw new OpenClawSessionFetchError(
      `Failed to fetch OpenClaw sessions from ${gatewayUrl}`,
      { cause: error },
    );
  }
}

export function upsertSessions(
  db: DBOrTx,
  connectionId: string,
  sessions: FetchedOpenClawSession[],
): OpenClawSession[] {
  if (sessions.length === 0) {
    return [];
  }

  const now = new Date();
  return sessions.map((session) =>
    db
      .insert(openclawSessions)
      .values({
        connectionId,
        sessionKey: session.sessionKey,
        agentId: session.agentId,
        model: session.model,
        status: session.status,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        metadata: session.metadata ? toJsonObject(session.metadata) : null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [openclawSessions.connectionId, openclawSessions.sessionKey],
        set: {
          agentId: session.agentId,
          model: session.model,
          status: "active",
          startedAt: session.startedAt,
          endedAt: null,
          metadata: session.metadata ? toJsonObject(session.metadata) : null,
          updatedAt: now,
        },
      })
      .returning()
      .get(),
  );
}

export async function syncSessions(
  db: DBOrTx,
  connection: OpenClawConnection,
  tokenOverride?: string,
): Promise<OpenClawSessionRecord[]> {
  if (!connection.gatewayUrl) {
    throw new Error(`OpenClaw connection ${connection.id} does not have a gateway URL`);
  }

  const token = resolveGatewayToken(connection, tokenOverride);
  let activeSessions: FetchedOpenClawSession[];

  try {
    activeSessions = await fetchActiveSessions(connection.gatewayUrl, token);
  } catch (error) {
    throw new OpenClawSessionFetchError(
      `Aborted OpenClaw session sync for connection ${connection.id}`,
      { cause: error },
    );
  }

  return db.transaction((tx) => {
    const upserted = upsertSessions(tx, connection.id, activeSessions);
    const activeSessionKeys = activeSessions.map((session) => session.sessionKey);
    const previouslyActive = tx
      .select()
      .from(openclawSessions)
      .where(
        and(
          eq(openclawSessions.connectionId, connection.id),
          eq(openclawSessions.status, "active"),
        ),
      )
      .all();

    const endedCandidates = previouslyActive.filter(
      (session) => !activeSessionKeys.includes(session.sessionKey),
    );

    const endedNow = endedCandidates.length > 0
      ? tx
          .update(openclawSessions)
          .set({
            status: "ended",
            endedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(inArray(openclawSessions.id, endedCandidates.map((session) => session.id)))
          .returning()
          .all()
      : [];

    const byId = new Map<string, OpenClawSession>();
    for (const session of [...upserted, ...endedNow]) {
      byId.set(session.id, session);
    }

    return Array.from(byId.values())
      .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())
      .map(deserializeSession);
  });
}

export function listSessions(
  db: DBOrTx,
  filters: OpenClawSessionFilters = {},
): OpenClawSessionRecord[] {
  const conditions: SQL[] = [];

  if (filters.connectionId) {
    conditions.push(eq(openclawSessions.connectionId, filters.connectionId));
  }

  if (filters.status) {
    conditions.push(eq(openclawSessions.status, filters.status));
  }

  const query = db
    .select()
    .from(openclawSessions)
    .orderBy(desc(openclawSessions.updatedAt))
    .$dynamic();

  const rows = conditions.length > 0
    ? query.where(and(...conditions)).limit(filters.limit ?? 20).all()
    : query.limit(filters.limit ?? 20).all();

  return rows.map(deserializeSession);
}

const DEFAULT_ACTIVE_WINDOW_MINUTES = 30;

export interface SyncAgentStatusOptions {
  connectionId?: string;
  windowMinutes?: number;
}

export interface SyncAgentStatusResult {
  updatedOnline: number;
  updatedIdle: number;
}

function getCutoffTime(windowMinutes: number): Date {
  return new Date(Date.now() - windowMinutes * 60 * 1000);
}

export function getActiveSessionAgentIds(
  db: DBOrTx,
  options: { connectionId?: string; windowMinutes?: number } = {},
): Set<string> {
  const windowMinutes = options.windowMinutes ?? DEFAULT_ACTIVE_WINDOW_MINUTES;
  const cutoff = getCutoffTime(windowMinutes);

  const sessionConditions: SQL[] = [
    eq(openclawSessions.status, "active"),
    gte(openclawSessions.startedAt, cutoff),
  ];

  if (options.connectionId) {
    sessionConditions.push(eq(openclawSessions.connectionId, options.connectionId));
  }

  const sessions = db
    .select({ agentId: openclawSessions.agentId })
    .from(openclawSessions)
    .where(and(...sessionConditions))
    .all();

  const externalAgentIds = sessions
    .map((s) => s.agentId)
    .filter((id): id is string => id !== null && id !== undefined);

  if (externalAgentIds.length === 0) {
    return new Set();
  }

  const agentMappings = db
    .select({ linkedAgentId: openclawAgents.linkedAgentId })
    .from(openclawAgents)
    .where(inArray(openclawAgents.externalAgentId, externalAgentIds))
    .all();

  return new Set(
    agentMappings
      .map((m) => m.linkedAgentId)
      .filter((id): id is string => id !== null && id !== undefined),
  );
}

export function syncAgentStatusFromSessions(
  db: DBOrTx,
  options: SyncAgentStatusOptions = {},
): SyncAgentStatusResult {
  const activeAgentIds = getActiveSessionAgentIds(db, options);

  const allLinkedAgents = db
    .select({ agentId: openclawAgents.linkedAgentId })
    .from(openclawAgents)
    .all();

  const linkedAgentIds = allLinkedAgents
    .map((m) => m.agentId)
    .filter((id): id is string => id !== null && id !== undefined);

  if (linkedAgentIds.length === 0) {
    return { updatedOnline: 0, updatedIdle: 0 };
  }

  const now = new Date();

  const onlineResult = activeAgentIds.size > 0
    ? db
        .update(agents)
        .set({ status: AgentStatus.online, lastActive: now })
        .where(inArray(agents.id, Array.from(activeAgentIds)))
        .returning()
    : { all: () => [] };

  const onlineUpdated = onlineResult.all().length;

  const idleCandidateIds = linkedAgentIds.filter((id) => !activeAgentIds.has(id));

  const idleResult = idleCandidateIds.length > 0
    ? db
        .update(agents)
        .set({ status: AgentStatus.idle })
        .where(
          and(
            inArray(agents.id, idleCandidateIds),
            sql`${agents.status} != ${AgentStatus.idle}`,
          ),
        )
        .returning()
    : { all: () => [] };

  const idleUpdated = idleResult.all().length;

  return { updatedOnline: onlineUpdated, updatedIdle: idleUpdated };
}
