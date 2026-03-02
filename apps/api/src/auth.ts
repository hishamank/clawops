import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "@clawops/core";
import { getAgentByApiKey } from "@clawops/agents";
import { hashApiKey } from "@clawops/domain";

declare module "fastify" {
  interface FastifyRequest {
    agentId?: string;
  }
}

/**
 * Fastify pre-handler that authenticates requests via API key.
 *
 * Reads the key from `x-api-key` header or `Authorization: Bearer <key>`,
 * hashes it with scrypt, and resolves the owning agent. On success the
 * authenticated agent's ID is attached as `request.agentId`.
 *
 * Responds with 401 if the key is missing or does not match any agent.
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const key =
    request.headers["x-api-key"] ??
    request.headers["authorization"]?.replace(/^Bearer\s+/i, "");

  if (!key || typeof key !== "string") {
    reply.code(401).send({ error: "Missing API key", code: "UNAUTHORIZED" });
    return;
  }

  const hashed = hashApiKey(key);
  const agent = getAgentByApiKey(db, hashed);

  if (!agent) {
    reply.code(401).send({ error: "Invalid API key", code: "UNAUTHORIZED" });
    return;
  }

  request.agentId = agent.id;
}
