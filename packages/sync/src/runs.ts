import {
  desc,
  eq,
  parseJsonObject,
  syncRunItems,
  syncRuns,
  toJsonObject,
  type DB,
  type SyncRun,
  type SyncRunItem,
} from "@clawops/core";

export interface StartSyncRunInput {
  connectionId?: string;
  syncType?: "manual" | "scheduled" | "reconcile";
  meta?: Record<string, unknown>;
}

export interface FinishSyncRunItemInput {
  itemType: "agent" | "workspace" | "cron_job";
  itemExternalId: string;
  changeType: "seen" | "added" | "updated" | "removed" | "failed";
  summary?: string;
  meta?: Record<string, unknown>;
}

export interface FinishSyncRunInput {
  status: "success" | "failed";
  agentCount?: number;
  cronJobCount?: number;
  workspaceCount?: number;
  addedCount?: number;
  updatedCount?: number;
  removedCount?: number;
  error?: string;
  meta?: Record<string, unknown>;
  items?: FinishSyncRunItemInput[];
}

export interface SyncRunSummary extends SyncRun {
  metaObject: Record<string, unknown>;
  items: Array<SyncRunItem & { metaObject: Record<string, unknown> }>;
}

export function startSyncRun(db: DB, input: StartSyncRunInput = {}): SyncRun {
  const rows = db
    .insert(syncRuns)
    .values({
      connectionId: input.connectionId ?? null,
      syncType: input.syncType ?? "manual",
      status: "running",
      meta: input.meta ? toJsonObject(input.meta) : null,
    })
    .returning()
    .all();

  const run = rows[0];
  if (!run) {
    throw new Error("Failed to create sync run");
  }

  return run;
}

export function finishSyncRun(db: DB, id: string, input: FinishSyncRunInput): SyncRunSummary {
  const rows = db
    .update(syncRuns)
    .set({
      status: input.status,
      completedAt: new Date(),
      agentCount: input.agentCount ?? 0,
      cronJobCount: input.cronJobCount ?? 0,
      workspaceCount: input.workspaceCount ?? 0,
      addedCount: input.addedCount ?? 0,
      updatedCount: input.updatedCount ?? 0,
      removedCount: input.removedCount ?? 0,
      error: input.error ?? null,
      meta: input.meta ? toJsonObject(input.meta) : null,
    })
    .where(eq(syncRuns.id, id))
    .returning()
    .all();

  const run = rows[0];
  if (!run) {
    throw new Error(`Sync run not found: ${id}`);
  }

  if (input.items && input.items.length > 0) {
    db.insert(syncRunItems)
      .values(
        input.items.map((item) => ({
          syncRunId: run.id,
          itemType: item.itemType,
          itemExternalId: item.itemExternalId,
          changeType: item.changeType,
          summary: item.summary ?? null,
          meta: item.meta ? toJsonObject(item.meta) : null,
        })),
      )
      .run();
  }

  const summary = getSyncRun(db, run.id);
  if (!summary) {
    throw new Error(`Sync run not found after completion: ${run.id}`);
  }

  return summary;
}

export function getSyncRun(db: DB, id: string): SyncRunSummary | null {
  const run = db.select().from(syncRuns).where(eq(syncRuns.id, id)).limit(1).all()[0] ?? null;
  if (!run) {
    return null;
  }

  const items = db
    .select()
    .from(syncRunItems)
    .where(eq(syncRunItems.syncRunId, id))
    .all();

  return {
    ...run,
    metaObject: parseJsonObject(run.meta),
    items: items.map((item) => ({
      ...item,
      metaObject: parseJsonObject(item.meta),
    })),
  };
}

export function listSyncRuns(db: DB, limit = 10): SyncRunSummary[] {
  const runs = db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(limit).all();
  const summaries: SyncRunSummary[] = [];

  for (const run of runs) {
    const summary = getSyncRun(db, run.id);
    if (summary) {
      summaries.push(summary);
    }
  }

  return summaries;
}
