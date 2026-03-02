import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { db, runMigrations } from "@clawops/core";
import { getAgentByApiKey } from "@clawops/agents";
import { hashApiKey } from "@clawops/domain";
import { projectRoutes } from "./routes/projects.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { notificationRoutes } from "./routes/notifications.js";
import { authRoutes } from "./routes/auth.js";

declare module "fastify" {
  interface FastifyRequest {
    agentId?: string;
  }
}

const port = Number(process.env["PORT"] || 3001);
const host = process.env["HOST"] || "0.0.0.0";

const app = Fastify({ logger: true });

app.decorateRequest("agentId", undefined);

// ── Swagger ────────────────────────────────────────────────────────────────

await app.register(swagger, {
  openapi: {
    info: {
      title: "ClawOps API",
      version: "0.1.0",
      description: "Operations layer for AI agent teams",
    },
    components: {
      securitySchemes: {
        apiKey: {
          type: "apiKey",
          name: "x-api-key",
          in: "header",
        },
      },
    },
    security: [{ apiKey: [] }],
  },
});

await app.register(swaggerUi, { routePrefix: "/docs" });

// ── Auth hook ──────────────────────────────────────────────────────────────

app.addHook("onRequest", async (req, reply) => {
  const path = req.url.split("?")[0];

  if (path === "/health" || path.startsWith("/auth/")) {
    return;
  }

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

// ── Health ──────────────────────────────────────────────────────────────────

app.get("/health", { schema: { tags: ["system"], summary: "Health check" } }, async () => {
  return { status: "ok" };
});

// ── Routes ─────────────────────────────────────────────────────────────────

await app.register(projectRoutes);
await app.register(analyticsRoutes);
await app.register(notificationRoutes);
await app.register(authRoutes);

// ── Start ──────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  try {
    runMigrations();
    app.log.info("Migrations applied");

    await app.listen({ port, host });
    app.log.info(`ClawOps API listening on ${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
