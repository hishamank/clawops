import {
  createActivityEvent,
  type DBOrTx,
  type OpenClawConnection,
  type SyncRunItem,
  type WorkspaceFile,
} from "@clawops/core";
import { syncSessions, syncAgentStatusFromSessions } from "./openclaw/sessions.js";
import { syncCronJobs } from "@clawops/habits";
import { NotFoundError } from "@clawops/domain";
import { syncWorkspaceFiles, type WorkspaceFileSyncResult } from "./openclaw/files.js";
import { finishSyncRunWithTx, startSyncRun, type FinishSyncRunItemInput } from "./runs.js";

/**
 * Reconciliation mode - controls which modules are synchronized.
 */
export type ReconcileMode = "full" | "sessions" | "cron" | "files";

/**
 * Options for reconciliation runs.
 */
export interface ReconcileOptions {
  /**
   * Scope of reconciliation.
   * - "full": reconcile all modules (sessions, cron jobs, workspace files)
   * - "sessions": reconcile only OpenClaw sessions
   * - "cron": reconcile only cron jobs
   * - "files": reconcile only workspace files
   */
  mode?: ReconcileMode;
  /**
   * Optional gateway token for authenticated gateway calls.
   * If not provided, will use OPENCLAW_GATEWAY_TOKEN environment variable.
   */
  gatewayToken?: string;
  /**
   * Optional actor agent ID for audit trail.
   */
  actorAgentId?: string;
}

/**
 * Result of a reconciliation run.
 */
export interface ReconcileResult {
  /**
   * The sync run ID for this reconciliation.
   */
  syncRunId: string;
  /**
   * The connection that was reconciled.
   */
  connection: OpenClawConnection;
  /**
   * Timestamp when reconciliation completed.
   */
  completedAt: Date;
  /**
   * Number of agents synced.
   */
  agentCount: number;
  /**
   * Number of cron jobs synced.
   */
  cronJobCount: number;
  /**
   * Number of workspaces synced.
   */
  workspaceCount: number;
  /**
   * Number of items added during reconciliation.
   */
  addedCount: number;
  /**
   * Number of items updated during reconciliation.
   */
  updatedCount: number;
  /**
   * Number of items removed during reconciliation.
   */
  removedCount: number;
  /**
   * Items processed during reconciliation.
   */
  items: SyncRunItem[];
}

interface ReconcileContext {
  connection: OpenClawConnection;
  mode: ReconcileMode;
  gatewayToken?: string;
  actorAgentId?: string;
}

/**
 * Resolve the gateway token from options or environment.
 */
function resolveGatewayToken(connection: OpenClawConnection, options?: ReconcileOptions): string {
  const token = options?.gatewayToken ?? process.env["OPENCLAW_GATEWAY_TOKEN"]?.trim() ?? "";

  if (connection.hasGatewayToken && !token) {
    throw new Error(
      `OPENCLAW_GATEWAY_TOKEN is required for OpenClaw gateway calls on connection ${connection.id}`,
    );
  }

  return token;
}

/**
 * Reconcile OpenClaw sessions.
 */
async function reconcileSessions(
  db: DBOrTx,
  connection: OpenClawConnection,
  options?: ReconcileOptions,
): Promise<{ agentCount: number; addedCount: number; updatedCount: number; items: FinishSyncRunItemInput[] }> {
  const sessions = await syncSessions(db, connection, options?.gatewayToken);

  syncAgentStatusFromSessions(db, {
    connectionId: connection.id,
  });

  const activeSessions = sessions.filter((s) => s.status === "active");
  const endedSessions = sessions.filter((s) => s.status === "ended");

  const items: FinishSyncRunItemInput[] = sessions.map((session) => ({
    itemType: "agent" as const,
    itemExternalId: session.agentId ?? session.sessionKey,
    changeType: session.status === "active" ? "seen" as const : "updated" as const,
    summary: `Session ${session.status} for agent ${session.agentId ?? "unknown"}`,
    meta: {
      model: session.model,
      startedAt: session.startedAt.toISOString(),
      sessionKey: session.sessionKey,
    },
  }));

  return {
    agentCount: activeSessions.length,
    addedCount: activeSessions.length,
    updatedCount: endedSessions.length,
    items,
  };
}

/**
 * Reconcile cron jobs.
 */
async function reconcileCronJobs(
  db: DBOrTx,
  connection: OpenClawConnection,
  gatewayToken: string,
): Promise<{ cronJobCount: number; addedCount: number; updatedCount: number; items: FinishSyncRunItemInput[] }> {
  const cronJobs = await syncCronJobs(db, connection, gatewayToken);

  const activeCronJobs = cronJobs.filter((j) => j.enabled);
  const pausedCronJobs = cronJobs.filter((j) => !j.enabled);

  const items: FinishSyncRunItemInput[] = cronJobs.map((job) => ({
    itemType: "cron_job" as const,
    itemExternalId: job.externalId ?? job.id,
    changeType: "seen" as const,
    summary: `Cron job "${job.name}" (${job.status})`,
    meta: {
      schedule: job.schedule,
      cronExpr: job.cronExpr,
      lastRun: job.lastRun?.toISOString(),
      nextRun: job.nextRun?.toISOString(),
    },
  }));

  return {
    cronJobCount: cronJobs.length,
    addedCount: activeCronJobs.length,
    updatedCount: pausedCronJobs.length,
    items,
  };
}

/**
 * Reconcile workspace files.
 */
async function reconcileFiles(
  db: DBOrTx,
  connection: OpenClawConnection,
  options?: ReconcileOptions,
): Promise<{ workspaceCount: number; addedCount: number; updatedCount: number; items: FinishSyncRunItemInput[] }> {
  const result: WorkspaceFileSyncResult = await syncWorkspaceFiles(db, connection, options?.gatewayToken);

  const allFiles: WorkspaceFile[] = [...result.inserted, ...result.updated.map((change) => change.file)];

  const items: FinishSyncRunItemInput[] = allFiles.map((file) => ({
    itemType: "workspace" as const,
    itemExternalId: file.relativePath,
    changeType: "seen" as const,
    summary: `Workspace file ${file.relativePath}`,
    meta: {
      fileHash: file.fileHash,
      sizeBytes: file.sizeBytes,
      lastSeenAt: file.lastSeenAt?.toISOString(),
    },
  }));

  return {
    workspaceCount: result.fetchedCount,
    addedCount: result.inserted.length,
    updatedCount: result.updated.length,
    items,
  };
}

/**
 * Execute reconciliation for a specific mode.
 */
async function executeReconcileMode(
  db: DBOrTx,
  ctx: ReconcileContext,
): Promise<{
  agentCount: number;
  cronJobCount: number;
  workspaceCount: number;
  addedCount: number;
  updatedCount: number;
  items: FinishSyncRunItemInput[];
}> {
  let agentCount = 0;
  let cronJobCount = 0;
  let workspaceCount = 0;
  let addedCount = 0;
  let updatedCount = 0;
  const items: FinishSyncRunItemInput[] = [];

  const shouldRunFull = ctx.mode === "full";

  // Reconcile sessions
  if (shouldRunFull || ctx.mode === "sessions") {
    const sessionResult = await reconcileSessions(db, ctx.connection, { gatewayToken: ctx.gatewayToken });
    agentCount = sessionResult.agentCount;
    addedCount += sessionResult.addedCount;
    updatedCount += sessionResult.updatedCount;
    items.push(...sessionResult.items);
  }

  // Reconcile cron jobs
  if (shouldRunFull || ctx.mode === "cron") {
    const gatewayToken = resolveGatewayToken(ctx.connection, { gatewayToken: ctx.gatewayToken });
    const cronResult = await reconcileCronJobs(db, ctx.connection, gatewayToken);
    cronJobCount = cronResult.cronJobCount;
    addedCount += cronResult.addedCount;
    updatedCount += cronResult.updatedCount;
    items.push(...cronResult.items);
  }

  // Reconcile workspace files
  if (shouldRunFull || ctx.mode === "files") {
    const fileResult = await reconcileFiles(db, ctx.connection, { gatewayToken: ctx.gatewayToken });
    workspaceCount = fileResult.workspaceCount;
    addedCount += fileResult.addedCount;
    updatedCount += fileResult.updatedCount;
    items.push(...fileResult.items);
  }

  return {
    agentCount,
    cronJobCount,
    workspaceCount,
    addedCount,
    updatedCount,
    items,
  };
}

/**
 * Run an idempotent reconciliation for an OpenClaw connection.
 *
 * This function coordinates the lower-level sync modules for sessions,
 * cron jobs, file catalog updates, and other runtime state while writing
 * a durable sync run record.
 *
 * The operation is idempotent - repeated calls do not corrupt state.
 *
 * @param db - Database instance
 * @param connection - The OpenClaw connection to reconcile
 * @param options - Reconciliation options including mode and gateway token
 * @returns Result of the reconciliation run
 */
export async function reconcile(
  db: DBOrTx,
  connection: OpenClawConnection,
  options: ReconcileOptions = {},
): Promise<ReconcileResult> {
  const mode: ReconcileMode = options.mode ?? "full";

  // Start a sync run with reconcile type
  const run = startSyncRun(db, {
    connectionId: connection.id,
    syncType: "reconcile",
    meta: {
      mode,
      actorAgentId: options.actorAgentId,
    },
  });

  try {
    const ctx: ReconcileContext = {
      connection,
      mode,
      gatewayToken: options.gatewayToken,
      actorAgentId: options.actorAgentId,
    };

    const result = await executeReconcileMode(db, ctx);

    // Finish the sync run with results
    const summary = db.transaction((tx) => {
      const syncResult = finishSyncRunWithTx(tx, run.id, {
        connectionId: connection.id,
        status: "success",
        agentCount: result.agentCount,
        cronJobCount: result.cronJobCount,
        workspaceCount: result.workspaceCount,
        addedCount: result.addedCount,
        updatedCount: result.updatedCount,
        removedCount: 0,
        meta: {
          mode,
          gatewayUrl: connection.gatewayUrl,
        },
        items: result.items,
      });

      try {
        createActivityEvent(tx, {
          source: "sync",
          type: "sync.reconciled",
          title: `Reconciliation completed for ${connection.name} (${mode} mode)`,
          entityType: "sync_run",
          entityId: run.id,
          agentId: options.actorAgentId ?? null,
          metadata: JSON.stringify({
            connectionId: connection.id,
            connectionName: connection.name,
            mode,
            agentCount: result.agentCount,
            cronJobCount: result.cronJobCount,
            workspaceCount: result.workspaceCount,
          }),
        });
      } catch {
        // best-effort: don't let activity event failure break sync
      }

      return syncResult;
    });

    return {
      syncRunId: run.id,
      connection,
      completedAt: summary.completedAt ?? new Date(),
      agentCount: summary.agentCount,
      cronJobCount: summary.cronJobCount,
      workspaceCount: summary.workspaceCount,
      addedCount: summary.addedCount,
      updatedCount: summary.updatedCount,
      removedCount: summary.removedCount,
      items: summary.items,
    };
  } catch (error) {
    // Mark sync run as failed
    db.transaction((tx) => {
      finishSyncRunWithTx(tx, run.id, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        meta: {
          mode,
          connectionId: connection.id,
        },
      });

      try {
        createActivityEvent(tx, {
          source: "sync",
          severity: "error",
          type: "sync.reconcile_failed",
          title: `Reconciliation failed for ${connection.name}`,
          entityType: "sync_run",
          entityId: run.id,
          agentId: options.actorAgentId ?? null,
          metadata: JSON.stringify({
            connectionId: connection.id,
            mode,
            error: error instanceof Error ? error.message : String(error),
          }),
        });
      } catch {
        // best-effort
      }
    });

    throw error;
  }
}

/**
 * Get the OpenClaw connection by ID and run reconciliation.
 *
 * This is a convenience function that fetches the connection and then
 * calls reconcile().
 *
 * @param db - Database instance
 * @param connectionId - The ID of the OpenClaw connection to reconcile
 * @param options - Reconciliation options
 * @returns Result of the reconciliation run
 */
export async function reconcileConnection(
  db: DBOrTx,
  connectionId: string,
  options: ReconcileOptions = {},
): Promise<ReconcileResult> {
  const { getOpenClawConnection } = await import("./connections.js");

  const connection = getOpenClawConnection(db, connectionId);
  if (!connection) {
    throw new NotFoundError(`OpenClaw connection "${connectionId}" not found`);
  }

  return reconcile(db, connection, options);
}
