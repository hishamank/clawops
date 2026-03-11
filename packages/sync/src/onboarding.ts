import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initAgent } from "@clawops/agents";
import { events, type DB } from "@clawops/core";
import { upsertOpenClawConnection, type OpenClawConnectionSyncMode } from "./connections.js";
import { fetchGatewayCronJobs, scanOpenClaw } from "./openclaw/index.js";
import { finishSyncRun, startSyncRun } from "./runs.js";
import type { SyncAgent, SyncCronJob, SyncWorkspace } from "./types.js";

type TransactionDb = Parameters<DB["transaction"]>[0] extends (tx: infer T) => unknown ? T : DB;

export interface OpenClawOnboardingInput {
  source: string;
  openclawDir?: string;
  gatewayUrl?: string;
  gatewayToken?: string;
  connectionName?: string;
  syncMode?: OpenClawConnectionSyncMode;
  includeFiles?: boolean;
  actorAgentId?: string;
}

export interface OpenClawOnboardingAgentRegistration {
  discovered: SyncAgent;
  agentId: string;
  created: boolean;
}

export interface OpenClawOnboardingResult {
  connectionId: string;
  connectionCreated: boolean;
  syncRunId: string;
  syncedAt: string;
  gatewayUrl: string;
  openclawDir: string;
  agents: SyncAgent[];
  cronJobs: SyncCronJob[];
  workspaces: SyncWorkspace[];
  agentRegistrations: OpenClawOnboardingAgentRegistration[];
}

interface OnboardingDependencies {
  existsSync: typeof fs.existsSync;
  readdirSync: typeof fs.readdirSync;
  initAgent: typeof initAgent;
  upsertOpenClawConnection: typeof upsertOpenClawConnection;
  scanOpenClaw: typeof scanOpenClaw;
  fetchGatewayCronJobs: typeof fetchGatewayCronJobs;
  startSyncRun: typeof startSyncRun;
  finishSyncRun: typeof finishSyncRun;
}

const defaultDependencies: OnboardingDependencies = {
  existsSync: fs.existsSync,
  readdirSync: fs.readdirSync,
  initAgent,
  upsertOpenClawConnection,
  scanOpenClaw,
  fetchGatewayCronJobs,
  startSyncRun,
  finishSyncRun,
};

function resolvePath(inputPath: string): string {
  if (inputPath === "~") return os.homedir();
  if (inputPath.startsWith("~/")) return path.join(os.homedir(), inputPath.slice(2));
  return inputPath;
}

function defaultConnectionName(rootPath: string): string {
  const baseName = path.basename(rootPath);
  if (!baseName || baseName === "." || baseName === path.sep) {
    return "OpenClaw";
  }

  return `OpenClaw ${baseName}`;
}

function validateOpenClawDir(
  openclawDir: string,
  dependencies: Pick<OnboardingDependencies, "existsSync" | "readdirSync">,
): void {
  if (!dependencies.existsSync(openclawDir)) {
    throw new Error(`Directory not found: ${openclawDir}`);
  }

  const hasConfig = dependencies.existsSync(path.join(openclawDir, "openclaw.json"));
  const hasWorkspaces = dependencies.readdirSync(openclawDir).some(
    (entry) => entry === "workspace" || entry.startsWith("workspace-"),
  );

  if (!hasConfig && !hasWorkspaces) {
    throw new Error(
      `${openclawDir} does not look like an OpenClaw directory (no openclaw.json or workspace dirs)`,
    );
  }
}

export async function onboardOpenClaw(
  db: DB,
  input: OpenClawOnboardingInput,
  dependencies: OnboardingDependencies = defaultDependencies,
): Promise<OpenClawOnboardingResult> {
  const openclawDir = resolvePath(
    input.openclawDir ?? process.env["OPENCLAW_DIR"] ?? "~/.openclaw",
  );
  validateOpenClawDir(openclawDir, dependencies);

  const run = dependencies.startSyncRun(db, {
    syncType: "manual",
    meta: {
      source: input.source,
      openclawDir,
    },
  });

  try {
    const scanResult = dependencies.scanOpenClaw({
      openclawDir,
      gatewayUrl: input.gatewayUrl,
      gatewayToken: input.gatewayToken,
      includeFiles: input.includeFiles,
    });
    const cronJobs = input.gatewayToken
      ? await dependencies.fetchGatewayCronJobs(
          scanResult.gatewayUrl,
          input.gatewayToken,
        ).catch(() => [])
      : [];
    const syncedAt = new Date();

    return db.transaction((tx: TransactionDb) => {
      const connection = dependencies.upsertOpenClawConnection(tx as unknown as DB, {
        name: input.connectionName ?? defaultConnectionName(openclawDir),
        rootPath: openclawDir,
        gatewayUrl: scanResult.gatewayUrl,
        status: "active",
        syncMode: input.syncMode ?? "manual",
        hasGatewayToken: Boolean(input.gatewayToken),
        lastSyncedAt: syncedAt,
        meta: {
          source: input.source,
          agentCount: scanResult.agents.length,
          workspaceCount: scanResult.workspaces.length,
          cronJobCount: cronJobs.length,
        },
      });

      tx.insert(events)
        .values({
          id: crypto.randomUUID(),
          action: connection.created
            ? "openclaw.connection.created"
            : "openclaw.connection.updated",
          entityType: "openclaw_connection",
          entityId: connection.connection.id,
          agentId: input.actorAgentId ?? null,
          meta: JSON.stringify({
            rootPath: connection.connection.rootPath,
            gatewayUrl: connection.connection.gatewayUrl,
            source: input.source,
            created: connection.created,
          }),
          createdAt: syncedAt,
        })
        .run();

      const agentRegistrations = scanResult.agents.map((discovered) => {
        const registration = dependencies.initAgent(tx as unknown as DB, {
          name: discovered.name,
          model: discovered.model ?? "unknown",
          role: discovered.role ?? "agent",
          framework: discovered.framework ?? "openclaw",
          memoryPath: discovered.memoryPath ?? discovered.workspacePath,
          skills: discovered.skills,
          avatar: discovered.avatar,
          openclaw: {
            connectionId: connection.connection.id,
            externalAgentId: discovered.id,
            externalAgentName: discovered.name,
            workspacePath: discovered.workspacePath,
            memoryPath: discovered.memoryPath ?? discovered.workspacePath,
            defaultModel: discovered.model,
            role: discovered.role,
            avatar: discovered.avatar,
            lastSeenAt: syncedAt,
          },
        });

        tx.insert(events)
          .values({
            id: crypto.randomUUID(),
            action: registration.created ? "agent.registered" : "agent.updated",
            entityType: "agent",
            entityId: registration.agent.id,
            agentId: input.actorAgentId ?? null,
            meta: JSON.stringify({
              source: input.source,
              discoveredAgentId: discovered.id,
              framework: discovered.framework ?? "openclaw",
              workspacePath: discovered.workspacePath,
              created: registration.created,
            }),
            createdAt: syncedAt,
          })
          .run();

        return {
          discovered,
          agentId: registration.agent.id,
          created: registration.created,
        };
      });

      dependencies.finishSyncRun(tx as unknown as DB, run.id, {
        connectionId: connection.connection.id,
        status: "success",
        agentCount: scanResult.agents.length,
        cronJobCount: cronJobs.length,
        workspaceCount: scanResult.workspaces.length,
        addedCount:
          (connection.created ? 1 : 0) +
          agentRegistrations.filter((registration) => registration.created).length,
        updatedCount:
          (connection.created ? 0 : 1) +
          agentRegistrations.filter((registration) => !registration.created).length +
          scanResult.workspaces.length +
          cronJobs.length,
        removedCount: 0,
        meta: {
          source: input.source,
          gatewayUrl: scanResult.gatewayUrl,
          openclawDir,
          connectionId: connection.connection.id,
        },
        items: [
          ...scanResult.agents.map((agent) => ({
            itemType: "agent" as const,
            itemExternalId: agent.id,
            changeType: "seen" as const,
            summary: `Discovered agent ${agent.name}`,
            meta: { workspacePath: agent.workspacePath },
          })),
          ...scanResult.workspaces.map((workspace) => ({
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
          agentId: input.actorAgentId ?? null,
          meta: JSON.stringify({
            source: input.source,
            connectionId: connection.connection.id,
            agentCount: scanResult.agents.length,
            cronJobCount: cronJobs.length,
            workspaceCount: scanResult.workspaces.length,
          }),
          createdAt: syncedAt,
        })
        .run();

      return {
        connectionId: connection.connection.id,
        connectionCreated: connection.created,
        syncRunId: run.id,
        syncedAt: syncedAt.toISOString(),
        gatewayUrl: scanResult.gatewayUrl,
        openclawDir,
        agents: scanResult.agents,
        cronJobs,
        workspaces: scanResult.workspaces,
        agentRegistrations,
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    db.transaction((tx: TransactionDb) => {
      dependencies.finishSyncRun(tx as unknown as DB, run.id, {
        status: "failed",
        error: message,
        meta: {
          source: input.source,
          openclawDir,
        },
      });
      tx.insert(events)
        .values({
          id: crypto.randomUUID(),
          action: "sync.run.failed",
          entityType: "sync_run",
          entityId: run.id,
          agentId: input.actorAgentId ?? null,
          meta: JSON.stringify({
            source: input.source,
            error: message,
          }),
          createdAt: new Date(),
        })
        .run();
    });
    throw error;
  }
}
