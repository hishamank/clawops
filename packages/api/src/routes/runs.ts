import type { FastifyInstance } from "fastify";
import { eq, and, type SQL } from "drizzle-orm";
import { db } from "../db/index.js";
import { runs, agents } from "../db/schema.js";
import {
  createRunSchema,
  updateRunSchema,
  runIdParamSchema,
  listRunsQuerySchema,
} from "../schemas/runs.js";
import { agentIdParamSchema } from "../schemas/agents.js";

export async function runRoutes(app: FastifyInstance) {
  app.get("/api/runs", async (request, reply) => {
    const parsed = listRunsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation Error",
        message: parsed.error.issues.map((i) => i.message).join("; "),
        statusCode: 400,
      });
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
      return reply.status(400).send({
        error: "Validation Error",
        message: parsed.error.issues.map((i) => i.message).join("; "),
        statusCode: 400,
      });
    }

    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, parsed.data.agentId));

    if (!agent) {
      return reply.status(404).send({
        error: "Not Found",
        message: "Agent not found",
        statusCode: 404,
      });
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
      const paramsParsed = runIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Validation Error",
          message: paramsParsed.error.issues.map((i) => i.message).join("; "),
          statusCode: 400,
        });
      }

      const parsed = updateRunSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation Error",
          message: parsed.error.issues.map((i) => i.message).join("; "),
          statusCode: 400,
        });
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
        .where(eq(runs.id, paramsParsed.data.id))
        .returning();

      if (!run) {
        return reply.status(404).send({
          error: "Not Found",
          message: "Run not found",
          statusCode: 404,
        });
      }

      return run;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/agents/:id/runs",
    async (request, reply) => {
      const paramsParsed = agentIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Validation Error",
          message: paramsParsed.error.issues.map((i) => i.message).join("; "),
          statusCode: 400,
        });
      }

      return db
        .select()
        .from(runs)
        .where(eq(runs.agentId, paramsParsed.data.id));
    },
  );
}
