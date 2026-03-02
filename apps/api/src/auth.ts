import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "@clawops/core";
import { getAgentByApiKey } from "@clawops/agents";
import { hashApiKey } from "@clawops/domain";

declare module "fastify" {
  interface FastifyRequest {
    agentId?: string;
  }
}

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
