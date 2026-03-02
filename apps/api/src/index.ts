import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { runMigrations } from "@clawops/core";
import { authMiddleware } from "./auth.js";
import { agentRoutes } from "./routes/agents.js";
import { habitRoutes } from "./routes/habits.js";

const port = Number(process.env["PORT"] || 3001);
const host = process.env["HOST"] || "0.0.0.0";

// Simple in-memory rate limiter for auth checks (prevents brute force)
const authAttempts = new Map<string, { count: number; resetAt: number }>();
const AUTH_RATE_LIMIT = 20;
const AUTH_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = authAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    authAttempts.set(ip, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    return true;
  }
  if (entry.count >= AUTH_RATE_LIMIT) return false;
  entry.count++;
  return true;
}

const app = Fastify({ logger: true });

async function start(): Promise<void> {
  try {
    runMigrations();
    app.log.info("Migrations applied");

    await app.register(swagger, {
      openapi: {
        info: {
          title: "ClawOps API",
          version: "0.1.0",
          description: "Operations layer for AI agent teams",
        },
      },
    });

    await app.register(swaggerUi, { routePrefix: "/docs" });

    app.get("/health", async () => ({ status: "ok" }));

    // Auth middleware with inline rate limiting to prevent brute force
    app.addHook("onRequest", async (request, reply) => {
      const pathname = request.url.split("?")[0];
      if (
        pathname === "/health" ||
        pathname?.startsWith("/auth") ||
        pathname?.startsWith("/docs")
      ) {
        return;
      }
      // Rate limit before authorization check
      const ip = request.ip;
      if (!checkRateLimit(ip)) {
        await reply.status(429).send({ error: "Too many requests" });
        return;
      }
      await authMiddleware(request, reply);
    });

    await app.register(agentRoutes, { prefix: "/agents" });
    await app.register(habitRoutes, { prefix: "/habits" });

    await app.listen({ port, host });
    app.log.info(`ClawOps API listening on ${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
