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
      description: "Trigger an OpenClaw sync — scan workspace files and optionally fetch from gateway",
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
    const { agents, workspaces, gatewayUrl } = openclaw.scanOpenClaw({
      openclawDir: body.openclawDir,
      gatewayUrl: body.gatewayUrl,
    });

    // Fetch from gateway if token provided
    let cronJobs: Awaited<ReturnType<typeof openclaw.fetchGatewayCronJobs>> = [];
    if (body.gatewayToken) {
      cronJobs = await openclaw.fetchGatewayCronJobs(gatewayUrl, body.gatewayToken);
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
      description: "Install ClawOps SKILL.md to selected agent workspaces",
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

    const results = body.workspacePaths.map(workspacePath => {
      const result = openclaw.installClawOpsSkill(workspacePath);
      return { workspacePath, ...result };
    });

    return reply.status(200).send({ results });
  });

  // GET /sync/openclaw/status — last sync result
  app.get("/sync/openclaw/status", {
    schema: {
      description: "Get the last OpenClaw sync result",
      tags: ["sync"],
    },
  }, async (_req, reply) => {
    if (!lastSyncResult) {
      return reply.status(200).send({ synced: false, message: "No sync has been run yet" });
    }
    return reply.status(200).send({ synced: true, ...lastSyncResult });
  });
}
