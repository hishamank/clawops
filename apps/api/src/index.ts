import Fastify from "fastify";
import { runMigrations } from "@clawops/core";

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

    await app.listen({ port, host });
    app.log.info(`ClawOps API listening on ${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
