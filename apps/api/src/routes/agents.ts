import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, events, tasks, eq, desc, type Agent } from "@clawops/core";
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
  status: z.enum(["online", "idle", "busy", "offline"]),
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

      const result = createAgent(db, parsed.data);

      db.insert(events)
        .values({
          id: crypto.randomUUID(),
          agentId: result.id,
          action: "agent.registered",
          entityType: "agent",
          entityId: result.id,
          meta: JSON.stringify({ name: result.name }),
          createdAt: new Date(),
        })
        .run();

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
      const agent = getAgent(db, request.params.id);
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
              enum: ["online", "idle", "busy", "offline"],
            },
            message: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = statusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: parsed.error.message, code: "VALIDATION_ERROR" });
      }

      try {
        const agent = updateAgentStatus(
          db,
          request.params.id,
          parsed.data.status as AgentStatus,
          parsed.data.message,
        );

        db.insert(events)
          .values({
            id: crypto.randomUUID(),
            agentId: agent.id,
            action: "agent.status_updated",
            entityType: "agent",
            entityId: agent.id,
            meta: JSON.stringify({ status: parsed.data.status }),
            createdAt: new Date(),
          })
          .run();

        return stripApiKey(agent);
      } catch {
        return reply
          .code(404)
          .send({ error: "Agent not found", code: "NOT_FOUND" });
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
      const parsed = skillsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: parsed.error.message, code: "VALIDATION_ERROR" });
      }

      try {
        const agent = updateAgentSkills(
          db,
          request.params.id,
          parsed.data.skills,
        );

        db.insert(events)
          .values({
            id: crypto.randomUUID(),
            agentId: agent.id,
            action: "agent.skills_updated",
            entityType: "agent",
            entityId: agent.id,
            meta: JSON.stringify({ skills: parsed.data.skills }),
            createdAt: new Date(),
          })
          .run();

        return stripApiKey(agent);
      } catch {
        return reply
          .code(404)
          .send({ error: "Agent not found", code: "NOT_FOUND" });
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
      const agent = getAgent(db, request.params.id);
      if (!agent) {
        return reply
          .code(404)
          .send({ error: "Agent not found", code: "NOT_FOUND" });
      }

      const run = logHeartbeat(db, agent.id);

      updateAgentStatus(db, agent.id, AgentStatus.online);

      db.insert(events)
        .values({
          id: crypto.randomUUID(),
          agentId: agent.id,
          action: "agent.heartbeat",
          entityType: "agent",
          entityId: agent.id,
          meta: JSON.stringify({ habitRunId: run.id }),
          createdAt: new Date(),
        })
        .run();

      return reply.code(201).send(run);
    },
  );
}
