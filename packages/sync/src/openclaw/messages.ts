import {
  and,
  desc,
  eq,
  agentMessages,
  toJsonObject,
  parseJsonObject,
  type DBOrTx,
  type AgentMessage,
  type SQL,
} from "@clawops/core";

export interface AgentMessageFilters {
  connectionId?: string;
  fromAgentId?: string;
  toAgentId?: string;
  sessionId?: string;
  messageType?: string;
  channel?: string;
  limit?: number;
}

export interface CreateAgentMessageInput {
  connectionId: string;
  fromAgentId?: string | null;
  toAgentId?: string | null;
  sessionId?: string | null;
  channel?: string | null;
  messageType?: string | null;
  summary?: string | null;
  content?: string | null;
  meta?: Record<string, unknown> | null;
  sentAt?: Date;
}

export type AgentMessageRecord = Omit<AgentMessage, "meta"> & {
  meta: Record<string, unknown> | null;
};

function deserializeMessage(row: AgentMessage): AgentMessageRecord {
  return {
    ...row,
    meta: row.meta ? (parseJsonObject(row.meta) as Record<string, unknown>) : null,
  };
}

export function getAgentMessage(db: DBOrTx, id: string): AgentMessageRecord | null {
  const row = db.select().from(agentMessages).where(eq(agentMessages.id, id)).get() ?? null;
  return row ? deserializeMessage(row) : null;
}

export function listAgentMessages(
  db: DBOrTx,
  filters: AgentMessageFilters = {},
): AgentMessageRecord[] {
  const conditions: SQL[] = [];

  if (filters.connectionId) {
    conditions.push(eq(agentMessages.connectionId, filters.connectionId));
  }

  if (filters.fromAgentId) {
    conditions.push(eq(agentMessages.fromAgentId, filters.fromAgentId));
  }

  if (filters.toAgentId) {
    conditions.push(eq(agentMessages.toAgentId, filters.toAgentId));
  }

  if (filters.sessionId) {
    conditions.push(eq(agentMessages.sessionId, filters.sessionId));
  }

  if (filters.messageType) {
    conditions.push(eq(agentMessages.messageType, filters.messageType));
  }

  if (filters.channel) {
    conditions.push(eq(agentMessages.channel, filters.channel));
  }

  const query = db
    .select()
    .from(agentMessages)
    .orderBy(desc(agentMessages.sentAt))
    .$dynamic();

  const rows = conditions.length > 0
    ? query.where(and(...conditions)).limit(filters.limit ?? 100).all()
    : query.limit(filters.limit ?? 100).all();

  return rows.map(deserializeMessage);
}

export function createAgentMessage(
  db: DBOrTx,
  input: CreateAgentMessageInput,
): AgentMessageRecord {
  const row = db
    .insert(agentMessages)
    .values({
      connectionId: input.connectionId,
      fromAgentId: input.fromAgentId ?? null,
      toAgentId: input.toAgentId ?? null,
      sessionId: input.sessionId ?? null,
      channel: input.channel ?? null,
      messageType: input.messageType ?? null,
      summary: input.summary ?? null,
      content: input.content ?? null,
      meta: input.meta ? toJsonObject(input.meta) : null,
      ...(input.sentAt ? { sentAt: input.sentAt } : {}),
    })
    .returning()
    .get();

  return deserializeMessage(row);
}

export function upsertAgentMessages(
  db: DBOrTx,
  connectionId: string,
  messages: CreateAgentMessageInput[],
): AgentMessageRecord[] {
  if (messages.length === 0) {
    return [];
  }

  const results: AgentMessageRecord[] = [];

  for (const message of messages) {
    const row = db
      .insert(agentMessages)
      .values({
        connectionId,
        fromAgentId: message.fromAgentId ?? null,
        toAgentId: message.toAgentId ?? null,
        sessionId: message.sessionId ?? null,
        channel: message.channel ?? null,
        messageType: message.messageType ?? null,
        summary: message.summary ?? null,
        content: message.content ?? null,
        meta: message.meta ? toJsonObject(message.meta) : null,
        ...(message.sentAt ? { sentAt: message.sentAt } : {}),
      })
      .onConflictDoNothing()
      .returning()
      .get();

    if (row) {
      results.push(deserializeMessage(row));
    }
  }

  return results;
}
