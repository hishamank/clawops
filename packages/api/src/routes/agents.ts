import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { agents } from "../db/schema.js";

const createAgentSchema = z.object({
  name: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

const updateAgentSchema = z.object({
  status: z.enum(["online", "offline", "error"]),
  metadata: z.record(z.unknown()).optional(),
});

export async function agentRoutes(app: FastifyInstance) {
  app.get("/api/agents", async () => {
    return db.select().from(agents);
  });

  app.post("/api/agents", async (request, reply) => {
    const parsed = createAgentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
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
      const parsed = updateAgentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
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
        .where(eq(agents.id, request.params.id))
        .returning();

      if (!agent) {
        return reply.status(404).send({ error: "Agent not found" });
      }

      return agent;
    },
  );
}
