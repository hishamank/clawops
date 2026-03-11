import { eq, and } from "drizzle-orm";
import type { DB, Agent, OpenClawAgent } from "@clawops/core";
import { agents, openclawAgents, toJsonArray } from "@clawops/core";
import { generateId, hashApiKey, type AgentStatus } from "@clawops/domain";

// ── Input types ────────────────────────────────────────────────────────────

interface CreateAgentInput {
  name: string;
  model: string;
  role: string;
  framework: string;
  memoryPath?: string;
  skills?: string[];
  avatar?: string;
}

interface InitAgentInput {
  name: string;
  model: string;
  role: string;
  framework: string;
  memoryPath?: string;
  skills?: string[];
  avatar?: string;
  openclaw?: {
    connectionId: string;
    externalAgentId: string;
    externalAgentName: string;
    workspacePath?: string;
    memoryPath?: string;
    defaultModel?: string;
    role?: string;
    avatar?: string;
    lastSeenAt?: Date;
  };
}

interface OpenClawIdentityLookupInput {
  connectionId: string;
  externalAgentId: string;
}

export function getAgentByOpenClawIdentity(
  db: DB,
  input: OpenClawIdentityLookupInput,
): Agent | null {
  const rows = db
    .select({ agent: agents })
    .from(openclawAgents)
    .innerJoin(agents, eq(openclawAgents.linkedAgentId, agents.id))
    .where(
      and(
        eq(openclawAgents.connectionId, input.connectionId),
        eq(openclawAgents.externalAgentId, input.externalAgentId),
      ),
    )
    .limit(1)
    .all();

  return rows[0]?.agent ?? null;
}

export function getOpenClawAgentMapping(
  db: DB,
  connectionId: string,
  externalAgentId: string,
): OpenClawAgent | null {
  return db
    .select()
    .from(openclawAgents)
    .where(
      and(
        eq(openclawAgents.connectionId, connectionId),
        eq(openclawAgents.externalAgentId, externalAgentId),
      ),
    )
    .limit(1)
    .get() ?? null;
}

function findSingleAgentByNameAndFramework(
  db: DB,
  input: InitAgentInput,
): Agent | null {
  const rows = db
    .select()
    .from(agents)
    .where(and(eq(agents.name, input.name), eq(agents.framework, input.framework)))
    .limit(2)
    .all();

  return rows.length === 1 ? rows[0] ?? null : null;
}

export function upsertOpenClawAgentIdentity(
  db: DB,
  input: NonNullable<InitAgentInput["openclaw"]> & { linkedAgentId: string },
): OpenClawAgent {
  const now = new Date();
  const lastSeenAt = input.lastSeenAt ?? now;
  const rows = db
    .insert(openclawAgents)
    .values({
      connectionId: input.connectionId,
      linkedAgentId: input.linkedAgentId,
      externalAgentId: input.externalAgentId,
      externalAgentName: input.externalAgentName,
      workspacePath: input.workspacePath ?? null,
      memoryPath: input.memoryPath ?? null,
      defaultModel: input.defaultModel ?? null,
      role: input.role ?? null,
      avatar: input.avatar ?? null,
      lastSeenAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [openclawAgents.connectionId, openclawAgents.externalAgentId],
      set: {
        linkedAgentId: input.linkedAgentId,
        externalAgentName: input.externalAgentName,
        workspacePath: input.workspacePath ?? null,
        memoryPath: input.memoryPath ?? null,
        defaultModel: input.defaultModel ?? null,
        role: input.role ?? null,
        avatar: input.avatar ?? null,
        lastSeenAt,
        updatedAt: now,
      },
    })
    .returning()
    .all();

  return rows[0]!;
}

// ── createAgent ────────────────────────────────────────────────────────────

export function createAgent(
  db: DB,
  input: CreateAgentInput,
): Agent & { apiKey: string } {
  const rawKey = generateId();
  const hashed = hashApiKey(rawKey);

  const rows = db
    .insert(agents)
    .values({
      name: input.name,
      model: input.model,
      role: input.role,
      framework: input.framework,
      memoryPath: input.memoryPath ?? null,
      skills: input.skills ? toJsonArray(input.skills) : null,
      avatar: input.avatar ?? null,
      apiKey: hashed,
      status: "offline",
    })
    .returning()
    .all();

  const agent = rows[0]!;
  return { ...agent, apiKey: rawKey };
}

// ── getAgent ───────────────────────────────────────────────────────────────

export function getAgent(db: DB, id: string): Agent | null {
  const rows = db
    .select()
    .from(agents)
    .where(eq(agents.id, id))
    .limit(1)
    .all();
  return rows[0] ?? null;
}

// ── listAgents ─────────────────────────────────────────────────────────────

export function listAgents(db: DB): Agent[] {
  return db.select().from(agents).all();
}

// ── updateAgentStatus ──────────────────────────────────────────────────────

export function updateAgentStatus(
  db: DB,
  id: string,
  status: AgentStatus,
  _message?: string,
): Agent {
  const now = new Date();
  const rows = db
    .update(agents)
    .set({
      status,
      lastActive: now,
    })
    .where(eq(agents.id, id))
    .returning()
    .all();

  const agent = rows[0];
  if (!agent) {
    throw new Error(`Agent not found: ${id}`);
  }

  return agent;
}

// ── updateAgentSkills ──────────────────────────────────────────────────────

export function updateAgentSkills(
  db: DB,
  id: string,
  skills: string[],
): Agent {
  const rows = db
    .update(agents)
    .set({ skills: toJsonArray(skills) })
    .where(eq(agents.id, id))
    .returning()
    .all();

  const agent = rows[0];
  if (!agent) {
    throw new Error(`Agent not found: ${id}`);
  }

  return agent;
}

// ── getAgentByApiKey ───────────────────────────────────────────────────────

export function getAgentByApiKey(db: DB, hashedKey: string): Agent | null {
  const rows = db
    .select()
    .from(agents)
    .where(eq(agents.apiKey, hashedKey))
    .limit(1)
    .all();
  return rows[0] ?? null;
}

// ── initAgent ──────────────────────────────────────────────────────────────

export function initAgent(
  db: DB,
  input: InitAgentInput,
): { agent: Agent; apiKey?: string; created: boolean } {
  const existing =
    (input.openclaw
      ? getAgentByOpenClawIdentity(db, {
          connectionId: input.openclaw.connectionId,
          externalAgentId: input.openclaw.externalAgentId,
        })
      : null) ?? findSingleAgentByNameAndFramework(db, input);

  if (existing) {
    const current = existing;
    const rows = db
      .update(agents)
      .set({
        name: input.name,
        model: input.model,
        role: input.role,
        framework: input.framework,
        memoryPath: input.memoryPath ?? current.memoryPath,
        skills: input.skills ? toJsonArray(input.skills) : current.skills,
        avatar: input.avatar ?? current.avatar,
      })
      .where(eq(agents.id, current.id))
      .returning()
      .all();
    const agent = rows[0] ?? current;

    if (input.openclaw) {
      upsertOpenClawAgentIdentity(db, {
        ...input.openclaw,
        linkedAgentId: agent.id,
        memoryPath:
          input.openclaw.memoryPath ?? input.memoryPath ?? agent.memoryPath ?? undefined,
        defaultModel: input.openclaw.defaultModel ?? input.model,
        role: input.openclaw.role ?? input.role,
        avatar: input.openclaw.avatar ?? input.avatar ?? agent.avatar ?? undefined,
      });
    }

    return { agent, created: false };
  }

  const rawKey = generateId();
  const hashed = hashApiKey(rawKey);

  const rows = db
    .insert(agents)
    .values({
      name: input.name,
      model: input.model,
      role: input.role,
      framework: input.framework,
      memoryPath: input.memoryPath ?? null,
      skills: input.skills ? toJsonArray(input.skills) : null,
      avatar: input.avatar ?? null,
      apiKey: hashed,
      status: "offline",
    })
    .returning()
    .all();

  const agent = rows[0]!;

  if (input.openclaw) {
    upsertOpenClawAgentIdentity(db, {
      ...input.openclaw,
      linkedAgentId: agent.id,
      memoryPath:
        input.openclaw.memoryPath ?? input.memoryPath ?? agent.memoryPath ?? undefined,
      defaultModel: input.openclaw.defaultModel ?? input.model,
      role: input.openclaw.role ?? input.role,
      avatar: input.openclaw.avatar ?? input.avatar ?? agent.avatar ?? undefined,
    });
  }

  return { agent, apiKey: rawKey, created: true };
}
