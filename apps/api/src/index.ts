import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { runMigrations } from "@clawops/core";
import { authMiddleware } from "./auth.js";
import { agentRoutes } from "./routes/agents.js";
import { habitRoutes } from "./routes/habits.js";

const port = Number(process.env["PORT"] || 3001);
const host = process.env["HOST"] || "0.0.0.0";

const app = Fastify({ logger: true });

app.get("/health", async () => {
  return { status: "ok" };
});

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

    await app.register(swaggerUi, {
      routePrefix: "/docs",
    });

    // Auth middleware — skip /health and /docs
    app.addHook("onRequest", async (request, reply) => {
      const url = request.url;
      if (
        url === "/health" ||
        url === "/auth" ||
        url.startsWith("/docs") ||
        url.startsWith("/docs/")
      ) {
        return;
      }
      await authMiddleware(request, reply);
    });

    await app.register(agentRoutes);
    await app.register(habitRoutes);

    await app.listen({ port, host });
    app.log.info(`ClawOps API listening on ${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
