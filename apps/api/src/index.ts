import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import rateLimit from "@fastify/rate-limit";
import { db, runMigrations } from "@clawops/core";
import { getAgentByApiKey } from "@clawops/agents";
import { hashApiKey } from "@clawops/domain";
import { agentRoutes } from "./routes/agents.js";
import { habitRoutes } from "./routes/habits.js";
import { projectRoutes } from "./routes/projects.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { notificationRoutes } from "./routes/notifications.js";
import { authRoutes } from "./routes/auth.js";

const port = Number(process.env["PORT"] || 3001);
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

    await app.register(swaggerUi, { routePrefix: "/docs" });

    app.get("/health", { schema: { tags: ["system"], summary: "Health check" } }, async () => ({ status: "ok" }));

    // Public auth routes (login does not require an API key)
    await app.register(authRoutes, { prefix: "/auth" });

    // Protected scope: rate limiter registered before auth hook
    await app.register(async (protectedApp) => {
      await protectedApp.register(rateLimit, {
        max: 100,
        timeWindow: "1 minute",
        keyGenerator: (req) => req.ip,
      });

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

      await protectedApp.register(agentRoutes, { prefix: "/agents" });
      await protectedApp.register(habitRoutes, { prefix: "/habits" });
      await protectedApp.register(projectRoutes, { prefix: "/projects" });
      await protectedApp.register(analyticsRoutes, { prefix: "/analytics" });
      await protectedApp.register(notificationRoutes, { prefix: "/notifications" });
    });

    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
