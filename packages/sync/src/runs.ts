import {
  desc,
  eq,
  or,
  parseJsonObject,
  syncRunItems,
  syncRuns,
  toJsonObject,
  type DB,
  type SyncRun,
  type SyncRunItem,
} from "@clawops/core";

type TransactionDb = Parameters<DB["transaction"]>[0] extends (tx: infer T) => unknown ? T : DB;

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
  connectionId?: string | null;
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

function buildSyncRunSummary(
  run: SyncRun,
  items: SyncRunItem[],
): SyncRunSummary {
  return {
    ...run,
    metaObject: parseJsonObject(run.meta),
    items: items.map((item) => ({
      ...item,
      metaObject: parseJsonObject(item.meta),
    })),
  };
}

function listSyncRunItemsByRunIds(db: DB, runIds: string[]): SyncRunItem[] {
  if (runIds.length === 0) {
    return [];
  }

  const filters = runIds.map((runId) => eq(syncRunItems.syncRunId, runId));
  const whereClause = filters.length === 1 ? filters[0] : or(...filters);

  if (!whereClause) {
    return [];
  }

  return db
    .select()
    .from(syncRunItems)
    .where(whereClause)
    .all();
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
  return db.transaction((tx: TransactionDb) => {
    const rows = tx
      .update(syncRuns)
      .set({
        connectionId: input.connectionId === undefined ? undefined : input.connectionId,
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
      tx.insert(syncRunItems)
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

    const items = listSyncRunItemsByRunIds(tx as unknown as DB, [run.id]);
    return buildSyncRunSummary(run, items);
  });
}

export function getSyncRun(db: DB, id: string): SyncRunSummary | null {
  const run = db.select().from(syncRuns).where(eq(syncRuns.id, id)).limit(1).all()[0] ?? null;
  if (!run) {
    return null;
  }

  const items = listSyncRunItemsByRunIds(db, [id]);
  return buildSyncRunSummary(run, items);
}

export function listSyncRuns(db: DB, limit = 10): SyncRunSummary[] {
  const runs: SyncRun[] = db
    .select()
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt))
    .limit(limit)
    .all();
  const items = listSyncRunItemsByRunIds(
    db,
    runs.map((run: SyncRun) => run.id),
  );
  const itemsByRunId = new Map<string, SyncRunItem[]>();

  for (const item of items) {
    const existing = itemsByRunId.get(item.syncRunId) ?? [];
    existing.push(item);
    itemsByRunId.set(item.syncRunId, existing);
  }

  return runs.map((run: SyncRun) => buildSyncRunSummary(run, itemsByRunId.get(run.id) ?? []));
}
