export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { createActivityEvent, events, type DB } from "@clawops/core";
import { finishSyncRun, listSyncRuns, openclaw, startSyncRun } from "@clawops/sync";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, jsonError } from "@/lib/server/runtime";

const syncRequestSchema = z.object({
  openclawDir: z.string().optional(),
  gatewayUrl: z.string().url().optional(),
  gatewayToken: z.string().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const db = getDb();
  let body: z.infer<typeof syncRequestSchema>;

  try {
    body = syncRequestSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }
    return jsonError(400, "Invalid request body", "VALIDATION_ERROR");
  }

  const run = startSyncRun(db, { syncType: "manual", meta: { source: "api.sync.openclaw" } });

  try {
    const scanResult = openclaw.scanOpenClaw({
      openclawDir: body.openclawDir,
      gatewayUrl: body.gatewayUrl,
    });
    const { agents, workspaces, gatewayUrl } = scanResult;

    let cronJobs: Awaited<ReturnType<typeof openclaw.fetchGatewayCronJobs>> = [];
    if (body.gatewayToken) {
      try {
        cronJobs = await openclaw.fetchGatewayCronJobs(gatewayUrl, body.gatewayToken);
      } catch {
        cronJobs = [];
      }
    }

    const syncedAt = new Date().toISOString();
    const completed = db.transaction((tx) => {
      const result = finishSyncRun(tx as unknown as DB, run.id, {
        status: "success",
        agentCount: agents.length,
        cronJobCount: cronJobs.length,
        workspaceCount: workspaces.length,
        updatedCount: agents.length + cronJobs.length + workspaces.length,
        meta: {
          source: "api.sync.openclaw",
          gatewayUrl,
          openclawDir: body.openclawDir ?? null,
        },
        items: [
          ...agents.map((agent) => ({
            itemType: "agent" as const,
            itemExternalId: agent.id,
            changeType: "seen" as const,
            summary: `Discovered agent ${agent.name}`,
            meta: { workspacePath: agent.workspacePath },
          })),
          ...workspaces.map((workspace) => ({
            itemType: "workspace" as const,
            itemExternalId: workspace.path,
            changeType: "seen" as const,
            summary: `Scanned workspace ${workspace.path}`,
            meta: {
              agentId: workspace.agentId,
              hasFiles: Object.values(workspace.files).some(Boolean),
            },
          })),
          ...cronJobs.map((cronJob) => ({
            itemType: "cron_job" as const,
            itemExternalId: cronJob.id,
            changeType: "seen" as const,
            summary: `Observed cron job ${cronJob.name}`,
            meta: { schedule: cronJob.schedule, enabled: cronJob.enabled },
          })),
        ],
      });
      tx.insert(events)
        .values({
          id: crypto.randomUUID(),
          action: "sync.run.completed",
          entityType: "sync_run",
          entityId: run.id,
          meta: JSON.stringify({
            status: result.status,
            agentCount: result.agentCount,
            cronJobCount: result.cronJobCount,
            workspaceCount: result.workspaceCount,
          }),
          createdAt: new Date(),
        })
        .run();
      return result;
    });

    try {
      createActivityEvent(db, {
        source: "sync",
        type: "sync.completed",
        title: `Sync completed: ${agents.length} agents, ${cronJobs.length} cron jobs`,
        entityType: "sync_run",
        entityId: completed.id,
        metadata: JSON.stringify({
          agentCount: agents.length,
          cronJobCount: cronJobs.length,
          workspaceCount: workspaces.length,
          agentNames: agents.map((a) => a.name),
        }),
      });
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      success: true,
      syncRunId: completed.id,
      syncedAt,
      agents,
      cronJobs,
      workspaces: workspaces.map((w) => ({
        agentId: w.agentId,
        path: w.path,
        hasFiles: Object.values(w.files).some(Boolean),
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    finishSyncRun(db, run.id, {
      status: "failed",
      error: message,
      meta: { source: "api.sync.openclaw" },
    });
    db.insert(events)
      .values({
        id: crypto.randomUUID(),
        action: "sync.run.failed",
        entityType: "sync_run",
        entityId: run.id,
        meta: JSON.stringify({ error: message }),
        createdAt: new Date(),
      })
      .run();
    try {
      createActivityEvent(db, {
        source: "sync",
        severity: "error",
        type: "sync.failed",
        title: "Sync failed",
        entityType: "sync_run",
        entityId: run.id,
        metadata: JSON.stringify({ error: message, syncRunId: run.id }),
      });
    } catch {
      // Non-critical
    }
    return jsonError(500, message, "INTERNAL_ERROR");
  }
}

export async function GET(): Promise<NextResponse> {
  const runs = listSyncRuns(getDb(), 10);
  const latest = runs[0];
  if (!latest) {
    return NextResponse.json({ synced: false, message: "No sync has been run yet", runs: [] });
  }
  return NextResponse.json({
    synced: latest.status === "success",
    syncRunId: latest.id,
    syncedAt: latest.completedAt?.toISOString() ?? latest.startedAt.toISOString(),
    agentCount: latest.agentCount,
    cronJobCount: latest.cronJobCount,
    workspaceCount: latest.workspaceCount,
    status: latest.status,
    error: latest.error,
    runs,
  });
}
