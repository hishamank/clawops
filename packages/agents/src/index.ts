import { and, eq } from "drizzle-orm";
import type { Agent, DB, OpenClawAgent } from "@clawops/core";
import { agents, openclawAgents, toJsonArray } from "@clawops/core";
import { generateId, hashApiKey, type AgentStatus } from "@clawops/domain";

/** Subset of DB that both the root connection and a transaction satisfy. */
type Queryable = Pick<DB, "insert" | "update" | "select" | "delete">;

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

/**
 * Retrieves an OpenClaw agent mapping by connection ID and external agent ID.
 * @param db - Database instance
 * @param connectionId - The OpenClaw connection ID
 * @param externalAgentId - The external agent ID from OpenClaw
 * @returns The OpenClaw agent mapping if found, null otherwise
 */
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

/**
 * Retrieves an OpenClaw agent mapping by the linked ClawOps agent ID.
 * @param db - Database instance
 * @param agentId - The internal ClawOps agent ID
 * @returns The OpenClaw agent mapping if found, null otherwise
 */
export function getOpenClawMappingByAgentId(
  db: DB,
  agentId: string,
): OpenClawAgent | null {
  return db
    .select()
    .from(openclawAgents)
    .where(eq(openclawAgents.linkedAgentId, agentId))
    .limit(1)
    .get() ?? null;
}

/**
 * Retrieves a ClawOps agent by its OpenClaw identity (connection ID + external agent ID).
 * @param db - Database instance
 * @param input - OpenClaw identity lookup input
 * @returns The ClawOps agent if found, null otherwise
 */
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

/**
 * Upserts an OpenClaw agent identity, linking it to a ClawOps agent.
 * Creates or updates the mapping based on connection ID and external agent ID.
 * @param db - Database instance (or transaction)
 * @param input - OpenClaw identity input with linked agent ID
 * @returns The upserted OpenClaw agent mapping
 * @throws Error if the upsert operation fails
 */
export function upsertOpenClawAgentIdentity(
  db: Queryable,
  input: NonNullable<InitAgentInput["openclaw"]> & { linkedAgentId: string },
): OpenClawAgent {
  const now = new Date();
  const lastSeenAt = input.lastSeenAt ?? now;
  const row = db
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
    .get();

  if (!row) {
    throw new Error(
      `Failed to upsert OpenClaw agent identity for connection=${input.connectionId}, externalAgent=${input.externalAgentId}`,
    );
  }
  return row;
}

/**
 * Creates a new ClawOps agent with the provided input.
 * @param db - Database instance
 * @param input - Agent creation input (name, model, role, framework, etc.)
 * @returns The created agent with its API key
 * @throws Error if agent creation fails
 */
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

  const agent = rows[0];
  if (!agent) {
    throw new Error(`Failed to create agent: ${input.name}`);
  }
  return { ...agent, apiKey: rawKey };
}

/**
 * Retrieves an agent by its ID.
 * @param db - Database instance
 * @param id - The agent ID
 * @returns The agent if found, null otherwise
 */
export function getAgent(db: DB, id: string): Agent | null {
  const rows = db
    .select()
    .from(agents)
    .where(eq(agents.id, id))
    .limit(1)
    .all();
  return rows[0] ?? null;
}

/**
 * Lists all agents in the database.
 * @param db - Database instance
 * @returns Array of all agents
 */
export function listAgents(db: DB): Agent[] {
  return db.select().from(agents).all();
}

/**
 * Updates an agent's status and last active timestamp.
 * @param db - Database instance
 * @param id - The agent ID
 * @param status - The new status
 * @param _message - Optional message (unused)
 * @returns The updated agent
 * @throws Error if agent not found
 */
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

/**
 * Updates an agent's skills.
 * @param db - Database instance
 * @param id - The agent ID
 * @param skills - Array of skill names
 * @returns The updated agent
 * @throws Error if agent not found
 */
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

/**
 * Retrieves an agent by its hashed API key.
 * @param db - Database instance
 * @param hashedKey - The hashed API key
 * @returns The agent if found, null otherwise
 */
export function getAgentByApiKey(db: DB, hashedKey: string): Agent | null {
  const rows = db
    .select()
    .from(agents)
    .where(eq(agents.apiKey, hashedKey))
    .limit(1)
    .all();
  return rows[0] ?? null;
}

/**
 * Initialise (find-or-create) an agent, optionally linking it to an OpenClaw
 * identity.
 *
 * **OpenClaw identity coverage:**
 * The durable identity lookup only activates when `input.openclaw` is provided.
 * CLI and web flows that route through `onboardOpenClaw` do pass OpenClaw
 * identity, so repeated syncs and renames resolve through the durable mapping.
 * Callers that omit `input.openclaw` still fall back to name/framework matching.
 */
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
    const agent = db.transaction((tx) => {
      const rows = tx
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
      const updated = rows[0];
      if (!updated) {
        throw new Error(`Failed to update agent during init: ${current.id}`);
      }

      if (input.openclaw) {
        upsertOpenClawAgentIdentity(tx as unknown as DB, {
          ...input.openclaw,
          linkedAgentId: updated.id,
          memoryPath:
            input.openclaw.memoryPath ?? input.memoryPath ?? updated.memoryPath ?? undefined,
          defaultModel: input.openclaw.defaultModel ?? input.model,
          role: input.openclaw.role ?? input.role,
          avatar: input.openclaw.avatar ?? input.avatar ?? updated.avatar ?? undefined,
        });
      }

      return updated;
    });

    return { agent, created: false };
  }

  const rawKey = generateId();
  const hashed = hashApiKey(rawKey);

  const agent = db.transaction((tx) => {
    const rows = tx
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

    const created = rows[0];
    if (!created) {
      throw new Error(`Failed to create agent during init: ${input.name}`);
    }

    if (input.openclaw) {
      upsertOpenClawAgentIdentity(tx as unknown as DB, {
        ...input.openclaw,
        linkedAgentId: created.id,
        memoryPath:
          input.openclaw.memoryPath ?? input.memoryPath ?? created.memoryPath ?? undefined,
        defaultModel: input.openclaw.defaultModel ?? input.model,
        role: input.openclaw.role ?? input.role,
        avatar: input.openclaw.avatar ?? input.avatar ?? created.avatar ?? undefined,
      });
    }

    return created;
  });

  return { agent, apiKey: rawKey, created: true };
}
