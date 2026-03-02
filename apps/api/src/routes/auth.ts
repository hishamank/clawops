import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "@clawops/core";
import { getAgentByApiKey } from "@clawops/agents";
import { hashApiKey } from "@clawops/domain";

// ── Schemas ────────────────────────────────────────────────────────────────

const loginBody = z.object({
  apiKey: z.string().min(1),
});

// ── Plugin ─────────────────────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /auth/login
  app.post(
    "/auth/login",
    {
      schema: {
        tags: ["auth"],
        summary: "Login with API key",
        body: {
          type: "object",
          properties: {
            apiKey: { type: "string" },
          },
          required: ["apiKey"],
        },
        response: {
          200: { type: "object", additionalProperties: true },
          401: {
            type: "object",
            properties: { error: { type: "string" }, code: { type: "string" } },
          },
        },
      },
    },
    async (req, reply) => {
      const { apiKey } = loginBody.parse(req.body);
      const hashed = hashApiKey(apiKey);
      const agent = getAgentByApiKey(db, hashed);
      if (!agent) {
        return reply.status(401).send({ error: "Invalid API key", code: "UNAUTHORIZED" });
      }
      return { id: agent.id, name: agent.name, model: agent.model, role: agent.role, status: agent.status };
    },
  );

  // POST /auth/logout
  app.post(
    "/auth/logout",
    {
      schema: {
        tags: ["auth"],
        summary: "Logout (stateless — returns 200)",
        response: {
          200: {
            type: "object",
            properties: { success: { type: "boolean" } },
          },
        },
      },
    },
    async () => {
      return { success: true };
    },
  );
}
