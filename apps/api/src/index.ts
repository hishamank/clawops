import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import rateLimit from "@fastify/rate-limit";
import { runMigrations } from "@clawops/core/migrate";
import { db } from "@clawops/core/db";
import { getAgentByApiKey } from "@clawops/agents";
import { hashApiKey } from "@clawops/domain";
import { agentRoutes } from "./routes/agents.js";
import { habitRoutes } from "./routes/habits.js";
import { projectRoutes } from "./routes/projects.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { notificationRoutes } from "./routes/notifications.js";
import { syncRoutes } from "./routes/sync.js";
import { authRoutes } from "./routes/auth.js";

const port = Number(process.env["API_PORT"] || 4444);
const host = process.env["HOST"] || "0.0.0.0";

const app = Fastify({ logger: true });

async function start(): Promise<void> {
  try {
    runMigrations();

    await app.register(swagger, {
      openapi: {
        info: { title: "ClawOps API", version: "0.1.0", description: "Operations layer for AI agent teams" },
        components: { securitySchemes: { apiKey: { type: "apiKey", name: "x-api-key", in: "header" } } },
        security: [{ apiKey: [] }],
      },
    });

    app.get("/health", { schema: { tags: ["system"], summary: "Health check" } }, async () => ({ status: "ok" }));

    // Public auth routes with dedicated rate limit
    await app.register(async (authScope) => {
      await authScope.register(rateLimit, {
        max: 10,
        timeWindow: "1 minute",
        keyGenerator: (req) => req.ip,
      });

      await authScope.register(authRoutes);
    });

    // Protected scope: rate limiter + auth hook + Swagger docs
    await app.register(async (protectedApp) => {
      await protectedApp.register(rateLimit, {
        max: 100,
        timeWindow: "1 minute",
        keyGenerator: (req) => req.ip,
      });

      await protectedApp.register(swaggerUi, { routePrefix: "/docs" });

      protectedApp.addHook("onRequest", async (req, reply) => {
        const key = req.headers["x-api-key"];
        if (typeof key !== "string" || key.length === 0) {
          return reply.status(401).send({ error: "Missing API key", code: "UNAUTHORIZED" });
        }
        const hashed = hashApiKey(key);
        const agent = getAgentByApiKey(db, hashed);
        if (!agent) {
          return reply.status(401).send({ error: "Invalid API key", code: "UNAUTHORIZED" });
        }
        req.agentId = agent.id;
      });

      await protectedApp.register(agentRoutes);
      await protectedApp.register(habitRoutes);
      await protectedApp.register(projectRoutes);
      await protectedApp.register(analyticsRoutes);
      await protectedApp.register(notificationRoutes);
      await protectedApp.register(syncRoutes);
    });

    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
