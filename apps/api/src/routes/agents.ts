import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, events, tasks, eq, desc, type Agent, type DB } from "@clawops/core";
import {
  createAgent,
  getAgent,
  listAgents,
  updateAgentStatus,
  updateAgentSkills,
} from "@clawops/agents";
import { listHabits, getHabitStreak, logHeartbeat } from "@clawops/habits";
import { AgentStatus } from "@clawops/domain";
import crypto from "node:crypto";

// ── Zod schemas ─────────────────────────────────────────────────────────────

const paramsSchema = z.object({ id: z.string().min(1) });

const registerSchema = z.object({
  name: z.string().min(1),
  model: z.string().min(1),
  role: z.string().min(1),
  framework: z.string().min(1),
  memoryPath: z.string().optional(),
  skills: z.array(z.string()).optional(),
  avatar: z.string().optional(),
});

const statusSchema = z.object({
  status: z.nativeEnum(AgentStatus),
  message: z.string().optional(),
});

const skillsSchema = z.object({
  skills: z.array(z.string()),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function stripApiKey(agent: Agent): Omit<Agent, "apiKey"> {
  const { apiKey: _key, ...rest } = agent;
  return rest;
}

function isNotFoundError(err: unknown): boolean {
  return err instanceof Error && /not found/i.test(err.message);
}

// ── Routes ──────────────────────────────────────────────────────────────────

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  // POST /agents/register
  app.post(
    "/agents/register",
    {
      schema: {
        tags: ["agents"],
        summary: "Register a new agent",
        body: {
          type: "object",
          required: ["name", "model", "role", "framework"],
          properties: {
            name: { type: "string" },
            model: { type: "string" },
            role: { type: "string" },
            framework: { type: "string" },
            memoryPath: { type: "string" },
            skills: { type: "array", items: { type: "string" } },
            avatar: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: parsed.error.message, code: "VALIDATION_ERROR" });
      }

      const result = db.transaction((tx) => {
        const agent = createAgent(tx as unknown as DB, parsed.data);

        tx.insert(events)
          .values({
            id: crypto.randomUUID(),
            agentId: agent.id,
            action: "agent.registered",
            entityType: "agent",
            entityId: agent.id,
            meta: JSON.stringify({ name: agent.name }),
            createdAt: new Date(),
          })
          .run();

        return agent;
      });

      return reply.code(201).send({
        ...stripApiKey(result),
        apiKey: result.apiKey,
      });
    },
  );

  // GET /agents
  app.get(
    "/agents",
    {
      schema: {
        tags: ["agents"],
        summary: "List all agents",
      },
    },
    async () => {
      return listAgents(db).map(stripApiKey);
    },
  );

  // GET /agents/:id
  app.get<{ Params: { id: string } }>(
    "/agents/:id",
    {
      schema: {
        tags: ["agents"],
        summary: "Get agent detail with recent tasks, habits, and streaks",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    },
    async (request, reply) => {
      const params = paramsSchema.safeParse(request.params);
      if (!params.success) {
        return reply
          .code(400)
          .send({ error: params.error.message, code: "VALIDATION_ERROR" });
      }

      const agent = getAgent(db, params.data.id);
      if (!agent) {
        return reply
          .code(404)
          .send({ error: "Agent not found", code: "NOT_FOUND" });
      }

      const recentTasks = db
        .select()
        .from(tasks)
        .where(eq(tasks.assigneeId, agent.id))
        .orderBy(desc(tasks.createdAt))
        .limit(10)
        .all();

      const agentHabits = listHabits(db, agent.id);

      const streaks = agentHabits.map((h) => ({
        habitId: h.id,
        name: h.name,
        streak: getHabitStreak(db, h.id, 7),
      }));

      return {
        ...stripApiKey(agent),
        recentTasks,
        habits: agentHabits,
        streaks,
      };
    },
  );

  // PATCH /agents/:id/status
  app.patch<{ Params: { id: string } }>(
    "/agents/:id/status",
    {
      schema: {
        tags: ["agents"],
        summary: "Update agent status",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: Object.values(AgentStatus),
            },
            message: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const params = paramsSchema.safeParse(request.params);
      if (!params.success) {
        return reply
          .code(400)
          .send({ error: params.error.message, code: "VALIDATION_ERROR" });
      }

      if (params.data.id !== request.agentId) {
        return reply
          .code(403)
          .send({ error: "Forbidden", code: "FORBIDDEN" });
      }

      const parsed = statusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: parsed.error.message, code: "VALIDATION_ERROR" });
      }

      try {
        const agent = db.transaction((tx) => {
          const a = updateAgentStatus(
            tx as unknown as DB,
            params.data.id,
            parsed.data.status,
            parsed.data.message,
          );

          tx.insert(events)
            .values({
              id: crypto.randomUUID(),
              agentId: a.id,
              action: "agent.status_updated",
              entityType: "agent",
              entityId: a.id,
              meta: JSON.stringify({ status: parsed.data.status }),
              createdAt: new Date(),
            })
            .run();

          return a;
        });

        return stripApiKey(agent);
      } catch (err) {
        if (isNotFoundError(err)) {
          return reply
            .code(404)
            .send({ error: "Agent not found", code: "NOT_FOUND" });
        }
        throw err;
      }
    },
  );

  // PATCH /agents/:id/skills
  app.patch<{ Params: { id: string } }>(
    "/agents/:id/skills",
    {
      schema: {
        tags: ["agents"],
        summary: "Update agent skills",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["skills"],
          properties: {
            skills: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    async (request, reply) => {
      const params = paramsSchema.safeParse(request.params);
      if (!params.success) {
        return reply
          .code(400)
          .send({ error: params.error.message, code: "VALIDATION_ERROR" });
      }

      if (params.data.id !== request.agentId) {
        return reply
          .code(403)
          .send({ error: "Forbidden", code: "FORBIDDEN" });
      }

      const parsed = skillsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: parsed.error.message, code: "VALIDATION_ERROR" });
      }

      try {
        const agent = db.transaction((tx) => {
          const a = updateAgentSkills(tx as unknown as DB, params.data.id, parsed.data.skills);

          tx.insert(events)
            .values({
              id: crypto.randomUUID(),
              agentId: a.id,
              action: "agent.skills_updated",
              entityType: "agent",
              entityId: a.id,
              meta: JSON.stringify({ skills: parsed.data.skills }),
              createdAt: new Date(),
            })
            .run();

          return a;
        });

        return stripApiKey(agent);
      } catch (err) {
        if (isNotFoundError(err)) {
          return reply
            .code(404)
            .send({ error: "Agent not found", code: "NOT_FOUND" });
        }
        throw err;
      }
    },
  );

  // POST /agents/:id/heartbeat
  app.post<{ Params: { id: string } }>(
    "/agents/:id/heartbeat",
    {
      schema: {
        tags: ["agents"],
        summary: "Record agent heartbeat",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    },
    async (request, reply) => {
      const params = paramsSchema.safeParse(request.params);
      if (!params.success) {
        return reply
          .code(400)
          .send({ error: params.error.message, code: "VALIDATION_ERROR" });
      }

      if (params.data.id !== request.agentId) {
        return reply
          .code(403)
          .send({ error: "Forbidden", code: "FORBIDDEN" });
      }

      const agent = getAgent(db, params.data.id);
      if (!agent) {
        return reply
          .code(404)
          .send({ error: "Agent not found", code: "NOT_FOUND" });
      }

      const run = db.transaction((tx) => {
        const r = logHeartbeat(tx as unknown as DB, agent.id);

        updateAgentStatus(tx as unknown as DB, agent.id, AgentStatus.online);

        tx.insert(events)
          .values({
            id: crypto.randomUUID(),
            agentId: agent.id,
            action: "agent.heartbeat",
            entityType: "agent",
            entityId: agent.id,
            meta: JSON.stringify({ habitRunId: r.id }),
            createdAt: new Date(),
          })
          .run();

        return r;
      });

      return reply.code(201).send(run);
    },
  );
}
