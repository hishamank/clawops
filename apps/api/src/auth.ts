import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "@clawops/core";
import { getAgentByApiKey } from "@clawops/agents";
import { hashApiKey } from "@clawops/domain";

declare module "fastify" {
  interface FastifyRequest {
    agentId?: string;
  }
}

/** In-memory rate limiter — prevents brute-force on API key auth */
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 20;
const WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (entry.count >= MAX_ATTEMPTS) return true;
  entry.count++;
  return false;
}

/**
 * Fastify pre-handler that authenticates requests via API key.
 * Includes per-IP rate limiting (20 req/min) to prevent brute force.
 *
 * Reads the key from `x-api-key` header or `Authorization: Bearer <key>`,
 * hashes it with scrypt, and resolves the owning agent. On success the
 * authenticated agent's ID is attached as `request.agentId`.
 *
 * Responds with 429 if rate limited, 401 if key is missing or invalid.
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Rate limiting before credential check
  if (isRateLimited(request.ip)) {
    reply.code(429).send({ error: "Too many requests", code: "RATE_LIMITED" });
    return;
  }

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
