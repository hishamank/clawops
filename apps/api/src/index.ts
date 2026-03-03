import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import rateLimit from "@fastify/rate-limit";
import { runMigrations } from "@clawops/core";
import { authMiddleware } from "./auth.js";
import { agentRoutes } from "./routes/agents.js";
import { habitRoutes } from "./routes/habits.js";

const port = Number(process.env["PORT"] || 3001);
const host = process.env["HOST"] || "0.0.0.0";

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

    // Protected scope: rate limiting applied before auth check (prevents brute force)
    await app.register(async (protectedApp) => {
      // Register rate limiter first — applies to all routes in this scope
      await protectedApp.register(rateLimit, {
        max: 100,
        timeWindow: "1 minute",
        keyGenerator: (req) => req.ip,
      });

      // Auth check runs after rate limiting
      protectedApp.addHook("onRequest", async (request, reply) => {
        await authMiddleware(request, reply);
      });

      await protectedApp.register(agentRoutes, { prefix: "/agents" });
      await protectedApp.register(habitRoutes, { prefix: "/habits" });
    });

    await app.listen({ port, host });
    app.log.info(`ClawOps API listening on ${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
