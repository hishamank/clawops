import type { FastifyInstance } from "fastify";
import { eq, and, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { runs, agents } from "../db/schema.js";

const createRunSchema = z.object({
  agentId: z.string().uuid(),
  task: z.string().min(1),
});

const updateRunSchema = z.object({
  status: z.enum(["pending", "running", "completed", "failed"]).optional(),
  output: z.string().optional(),
  error: z.string().optional(),
});

const listRunsQuerySchema = z.object({
  agent: z.string().uuid().optional(),
  status: z.enum(["pending", "running", "completed", "failed"]).optional(),
});

export async function runRoutes(app: FastifyInstance) {
  app.get("/api/runs", async (request, reply) => {
    const parsed = listRunsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const conditions: SQL[] = [];
    if (parsed.data.agent) {
      conditions.push(eq(runs.agentId, parsed.data.agent));
    }
    if (parsed.data.status) {
      conditions.push(eq(runs.status, parsed.data.status));
    }

    if (conditions.length === 0) {
      return db.select().from(runs);
    }

    return db
      .select()
      .from(runs)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions));
  });

  app.post("/api/runs", async (request, reply) => {
    const parsed = createRunSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, parsed.data.agentId));

    if (!agent) {
      return reply.status(404).send({ error: "Agent not found" });
    }

    const [run] = await db
      .insert(runs)
      .values({
        agentId: parsed.data.agentId,
        task: parsed.data.task,
        status: "running",
      })
      .returning();

    return reply.status(201).send(run);
  });

  app.patch<{ Params: { id: string } }>(
    "/api/runs/:id",
    async (request, reply) => {
      const parsed = updateRunSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const updates: Record<string, unknown> = {};
      if (parsed.data.status) updates.status = parsed.data.status;
      if (parsed.data.output !== undefined) updates.output = parsed.data.output;
      if (parsed.data.error !== undefined) updates.error = parsed.data.error;

      if (
        parsed.data.status === "completed" ||
        parsed.data.status === "failed"
      ) {
        updates.finishedAt = new Date().toISOString();
      }

      const [run] = await db
        .update(runs)
        .set(updates)
        .where(eq(runs.id, request.params.id))
        .returning();

      if (!run) {
        return reply.status(404).send({ error: "Run not found" });
      }

      return run;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/agents/:id/runs",
    async (request) => {
      return db
        .select()
        .from(runs)
        .where(eq(runs.agentId, request.params.id));
    },
  );
}
