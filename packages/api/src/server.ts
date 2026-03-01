import Fastify from "fastify";
import cors from "@fastify/cors";
import { agentRoutes } from "./routes/agents.js";
import { runRoutes } from "./routes/runs.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

await app.register(agentRoutes);
await app.register(runRoutes);

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
