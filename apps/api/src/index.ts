import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { db, runMigrations } from "@clawops/core";
import { getAgentByApiKey } from "@clawops/agents";
import { hashApiKey } from "@clawops/domain";
import { taskRoutes } from "./routes/tasks.js";
import { ideaRoutes } from "./routes/ideas.js";

const port = Number(process.env["PORT"] || 3001);
const host = process.env["HOST"] || "0.0.0.0";

const app = Fastify({ logger: true });

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

const publicPaths = new Set(["/health"]);

app.addHook("onRequest", async (req, reply) => {
  const pathname = req.url.split("?")[0];
  if (publicPaths.has(pathname)) {
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
});

// ── Health ──────────────────────────────────────────────────────────────────

app.get("/health", { schema: { tags: ["system"], summary: "Health check" } }, async () => {
  return { status: "ok" };
});

// ── Routes ─────────────────────────────────────────────────────────────────

await app.register(taskRoutes);
await app.register(ideaRoutes);

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
