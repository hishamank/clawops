import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, events } from "@clawops/core";
import { createHabit, listHabits, logHabitRun } from "@clawops/habits";
import { getAgent } from "@clawops/agents";
import crypto from "node:crypto";

// ── Zod schemas ─────────────────────────────────────────────────────────────

const createHabitSchema = z.object({
  agentId: z.string().min(1),
  name: z.string().min(1),
  type: z.enum([
    "heartbeat",
    "scheduled",
    "cron",
    "hook",
    "watchdog",
    "polling",
  ]),
  schedule: z.string().optional(),
  cronExpr: z.string().optional(),
  trigger: z.string().optional(),
  status: z.enum(["active", "paused"]).optional(),
});

const habitRunSchema = z.object({
  agentId: z.string().min(1),
  success: z.boolean(),
  note: z.string().optional(),
});

// ── Routes ──────────────────────────────────────────────────────────────────

export async function habitRoutes(app: FastifyInstance): Promise<void> {
  // POST /habits
  app.post(
    "/habits",
    {
      schema: {
        tags: ["habits"],
        summary: "Create a habit",
        body: {
          type: "object",
          required: ["agentId", "name", "type"],
          properties: {
            agentId: { type: "string" },
            name: { type: "string" },
            type: {
              type: "string",
              enum: [
                "heartbeat",
                "scheduled",
                "cron",
                "hook",
                "watchdog",
                "polling",
              ],
            },
            schedule: { type: "string" },
            cronExpr: { type: "string" },
            trigger: { type: "string" },
            status: { type: "string", enum: ["active", "paused"] },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = createHabitSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: parsed.error.message, code: "VALIDATION_ERROR" });
      }

      const { agentId, ...input } = parsed.data;

      const agent = getAgent(db, agentId);
      if (!agent) {
        return reply
          .code(404)
          .send({ error: "Agent not found", code: "NOT_FOUND" });
      }

      const habit = createHabit(db, agentId, input);

      db.insert(events)
        .values({
          id: crypto.randomUUID(),
          agentId,
          action: "habit.created",
          entityType: "habit",
          entityId: habit.id,
          meta: JSON.stringify({ name: habit.name, type: habit.type }),
          createdAt: new Date(),
        })
        .run();

      return reply.code(201).send(habit);
    },
  );

  // GET /habits
  app.get<{ Querystring: { agentId?: string } }>(
    "/habits",
    {
      schema: {
        tags: ["habits"],
        summary: "List habits, optionally filtered by agentId",
        querystring: {
          type: "object",
          properties: {
            agentId: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      return listHabits(db, request.query.agentId);
    },
  );

  // POST /habits/:id/run
  app.post<{ Params: { id: string } }>(
    "/habits/:id/run",
    {
      schema: {
        tags: ["habits"],
        summary: "Log a habit run",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["agentId", "success"],
          properties: {
            agentId: { type: "string" },
            success: { type: "boolean" },
            note: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = habitRunSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: parsed.error.message, code: "VALIDATION_ERROR" });
      }

      try {
        const run = logHabitRun(db, request.params.id, parsed.data.agentId, {
          success: parsed.data.success,
          note: parsed.data.note,
        });

        db.insert(events)
          .values({
            id: crypto.randomUUID(),
            agentId: parsed.data.agentId,
            action: "habit.run_logged",
            entityType: "habitRun",
            entityId: run.id,
            meta: JSON.stringify({
              habitId: request.params.id,
              success: parsed.data.success,
            }),
            createdAt: new Date(),
          })
          .run();

        return reply.code(201).send(run);
      } catch {
        return reply
          .code(404)
          .send({
            error: "Habit not found or does not belong to agent",
            code: "NOT_FOUND",
          });
      }
    },
  );
}
