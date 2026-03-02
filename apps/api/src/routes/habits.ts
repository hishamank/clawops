import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, events, type DB } from "@clawops/core";
import { createHabit, listHabits, logHabitRun } from "@clawops/habits";
import { getAgent } from "@clawops/agents";
import { HabitType, HabitStatus } from "@clawops/domain";
import crypto from "node:crypto";

// ── Zod schemas ─────────────────────────────────────────────────────────────

const paramsSchema = z.object({ id: z.string().min(1) });

const createHabitSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(HabitType),
  schedule: z.string().optional(),
  cronExpr: z.string().optional(),
  trigger: z.string().optional(),
  status: z.nativeEnum(HabitStatus).optional(),
});

const habitRunSchema = z.object({
  success: z.boolean(),
  note: z.string().optional(),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function isNotFoundError(err: unknown): boolean {
  return err instanceof Error && /not found/i.test(err.message);
}

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
          required: ["name", "type"],
          properties: {
            name: { type: "string" },
            type: {
              type: "string",
              enum: Object.values(HabitType),
            },
            schedule: { type: "string" },
            cronExpr: { type: "string" },
            trigger: { type: "string" },
            status: { type: "string", enum: Object.values(HabitStatus) },
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

      const agentId = request.agentId!;

      const agent = getAgent(db, agentId);
      if (!agent) {
        return reply
          .code(404)
          .send({ error: "Agent not found", code: "NOT_FOUND" });
      }

      const habit = db.transaction((tx) => {
        const h = createHabit(tx as unknown as DB, agentId, parsed.data);

        tx.insert(events)
          .values({
            id: crypto.randomUUID(),
            agentId,
            action: "habit.created",
            entityType: "habit",
            entityId: h.id,
            meta: JSON.stringify({ name: h.name, type: h.type }),
            createdAt: new Date(),
          })
          .run();

        return h;
      });

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
          required: ["success"],
          properties: {
            success: { type: "boolean" },
            note: { type: "string" },
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

      const parsed = habitRunSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: parsed.error.message, code: "VALIDATION_ERROR" });
      }

      const agentId = request.agentId!;

      try {
        const run = db.transaction((tx) => {
          const r = logHabitRun(tx as unknown as DB, params.data.id, agentId, {
            success: parsed.data.success,
            note: parsed.data.note,
          });

          tx.insert(events)
            .values({
              id: crypto.randomUUID(),
              agentId,
              action: "habit.run_logged",
              entityType: "habitRun",
              entityId: r.id,
              meta: JSON.stringify({
                habitId: params.data.id,
                success: parsed.data.success,
              }),
              createdAt: new Date(),
            })
            .run();

          return r;
        });

        return reply.code(201).send(run);
      } catch (err) {
        if (isNotFoundError(err)) {
          return reply
            .code(404)
            .send({
              error: "Habit not found or does not belong to agent",
              code: "NOT_FOUND",
            });
        }
        throw err;
      }
    },
  );
}
