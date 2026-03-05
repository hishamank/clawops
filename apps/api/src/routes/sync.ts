import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { openclaw } from "@clawops/sync";

const syncRequestSchema = z.object({
  openclawDir: z.string().optional(),
  gatewayUrl: z.string().url().optional(),
  gatewayToken: z.string().optional(),
});

// In-memory last sync result (good enough for MVP)
let lastSyncResult: {
  syncedAt: string;
  agentCount: number;
  cronJobCount: number;
  agents: Array<{ id: string; name: string; workspacePath: string }>;
} | null = null;

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  // POST /sync/openclaw — trigger sync
  app.post("/sync/openclaw", {
    schema: {
      summary: "Trigger an OpenClaw sync — scan workspace files and optionally fetch from gateway",
      tags: ["sync"],
      body: {
        type: "object",
        properties: {
          openclawDir: { type: "string", description: "Path to ~/.openclaw directory" },
          gatewayUrl: { type: "string", description: "OpenClaw gateway URL" },
          gatewayToken: { type: "string", description: "Gateway API token" },
        },
      },
    },
  }, async (req, reply) => {
    const body = syncRequestSchema.parse(req.body ?? {});

    // Scan filesystem
    let scanResult: ReturnType<typeof openclaw.scanOpenClaw>;
    try {
      scanResult = openclaw.scanOpenClaw({
        openclawDir: body.openclawDir,
        gatewayUrl: body.gatewayUrl,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: `Scan failed: ${message}` });
    }
    const { agents, workspaces, gatewayUrl } = scanResult;

    // Fetch from gateway if token provided
    let cronJobs: Awaited<ReturnType<typeof openclaw.fetchGatewayCronJobs>> = [];
    if (body.gatewayToken) {
      try {
        cronJobs = await openclaw.fetchGatewayCronJobs(gatewayUrl, body.gatewayToken);
      } catch {
        // Gateway unreachable — continue with filesystem results only
        cronJobs = [];
      }
    }

    lastSyncResult = {
      syncedAt: new Date().toISOString(),
      agentCount: agents.length,
      cronJobCount: cronJobs.length,
      agents: agents.map(a => ({ id: a.id, name: a.name, workspacePath: a.workspacePath })),
    };

    return reply.status(200).send({
      success: true,
      syncedAt: lastSyncResult.syncedAt,
      agents,
      cronJobs,
      workspaces: workspaces.map(w => ({
        agentId: w.agentId,
        path: w.path,
        hasFiles: Object.values(w.files).some(Boolean),
      })),
    });
  });

  // POST /sync/openclaw/install-skill — install skill to selected agents
  app.post("/sync/openclaw/install-skill", {
    schema: {
      summary: "Install ClawOps SKILL.md to selected agent workspaces",
      tags: ["sync"],
      body: {
        type: "object",
        required: ["workspacePaths"],
        properties: {
          workspacePaths: {
            type: "array",
            items: { type: "string" },
            description: "List of workspace paths to install skill to",
          },
        },
      },
    },
  }, async (req, reply) => {
    const body = z.object({
      workspacePaths: z.array(z.string().min(1)),
    }).parse(req.body);

    // Basic path traversal protection — reject paths with ..
    const safePaths = body.workspacePaths.filter(p => !p.includes(".."));
    if (safePaths.length !== body.workspacePaths.length) {
      return reply.status(400).send({ error: "Invalid workspace path: path traversal not allowed" });
    }

    const results = safePaths.map(workspacePath => {
      const result = openclaw.installClawOpsSkill(workspacePath);
      return { workspacePath, ...result };
    });

    return reply.status(200).send({ results });
  });

  // GET /sync/openclaw/status — last sync result
  app.get("/sync/openclaw/status", {
    schema: {
      summary: "Get the last OpenClaw sync result",
      tags: ["sync"],
    },
  }, async (_req, reply) => {
    if (!lastSyncResult) {
      return reply.status(200).send({ synced: false, message: "No sync has been run yet" });
    }
    return reply.status(200).send({ synced: true, ...lastSyncResult });
  });
}
