import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { agents } from "../db/schema.js";
import {
  createAgentSchema,
  updateAgentSchema,
  agentIdParamSchema,
} from "../schemas/agents.js";

export async function agentRoutes(app: FastifyInstance) {
  app.get("/api/agents", async () => {
    return db.select().from(agents);
  });

  app.post("/api/agents", async (request, reply) => {
    const parsed = createAgentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation Error",
        message: parsed.error.issues.map((i) => i.message).join("; "),
        statusCode: 400,
      });
    }

    const [agent] = await db
      .insert(agents)
      .values({
        name: parsed.data.name,
        metadata: parsed.data.metadata ?? null,
      })
      .returning();

    return reply.status(201).send(agent);
  });

  app.patch<{ Params: { id: string } }>(
    "/api/agents/:id",
    async (request, reply) => {
      const paramsParsed = agentIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Validation Error",
          message: paramsParsed.error.issues.map((i) => i.message).join("; "),
          statusCode: 400,
        });
      }

      const parsed = updateAgentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation Error",
          message: parsed.error.issues.map((i) => i.message).join("; "),
          statusCode: 400,
        });
      }

      const [agent] = await db
        .update(agents)
        .set({
          status: parsed.data.status,
          lastSeen: new Date().toISOString(),
          ...(parsed.data.metadata !== undefined && {
            metadata: parsed.data.metadata,
          }),
        })
        .where(eq(agents.id, paramsParsed.data.id))
        .returning();

      if (!agent) {
        return reply.status(404).send({
          error: "Not Found",
          message: "Agent not found",
          statusCode: 404,
        });
      }

      return agent;
    },
  );
}
