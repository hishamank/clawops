import { eq, and } from "drizzle-orm";
import type { DB, Agent } from "@clawops/core";
import { agents, toJsonArray } from "@clawops/core";
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
  const existing = db
    .select()
    .from(agents)
    .where(and(eq(agents.name, input.name), eq(agents.framework, input.framework)))
    .limit(1)
    .all();

  if (existing[0]) {
    const current = existing[0];
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
    return { agent: rows[0] ?? current, created: false };
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
      apiKey: hashed,
      status: "offline",
    })
    .returning()
    .all();

  return { agent: rows[0]!, apiKey: rawKey, created: true };
}
