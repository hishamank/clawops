import {
  desc,
  eq,
  openclawConnections,
  toJsonObject,
  type DB,
  type OpenClawConnection,
} from "@clawops/core";

export type OpenClawConnectionStatus = "active" | "disconnected" | "error";
export type OpenClawConnectionSyncMode = "manual" | "hybrid";

export interface UpsertOpenClawConnectionInput {
  name: string;
  rootPath: string;
  gatewayUrl?: string;
  status?: OpenClawConnectionStatus;
  syncMode?: OpenClawConnectionSyncMode;
  hasGatewayToken?: boolean;
  meta?: Record<string, unknown>;
  lastSyncedAt?: Date | null;
}

export interface UpdateOpenClawConnectionInput {
  name?: string;
  gatewayUrl?: string | null;
  status?: OpenClawConnectionStatus;
  syncMode?: OpenClawConnectionSyncMode;
  hasGatewayToken?: boolean;
  meta?: Record<string, unknown>;
  lastSyncedAt?: Date | null;
}

export function listOpenClawConnections(db: DB): OpenClawConnection[] {
  return db
    .select()
    .from(openclawConnections)
    .orderBy(desc(openclawConnections.updatedAt))
    .all();
}

export function getOpenClawConnection(
  db: DB,
  id: string,
): OpenClawConnection | null {
  return db
    .select()
    .from(openclawConnections)
    .where(eq(openclawConnections.id, id))
    .get() ?? null;
}

export function getOpenClawConnectionByRootPath(
  db: DB,
  rootPath: string,
): OpenClawConnection | null {
  return db
    .select()
    .from(openclawConnections)
    .where(eq(openclawConnections.rootPath, rootPath))
    .get() ?? null;
}

export function upsertOpenClawConnection(
  db: DB,
  input: UpsertOpenClawConnectionInput,
): { connection: OpenClawConnection; created: boolean } {
  // Use a transaction + INSERT with ON CONFLICT to avoid the read-then-insert race condition.
  // SQLite's unique constraint on rootPath ensures atomicity.
  return db.transaction((tx) => {
    const now = new Date();

    // Attempt insert; conflict means the row already exists.
    const inserted = tx
      .insert(openclawConnections)
      .values({
        name: input.name,
        rootPath: input.rootPath,
        gatewayUrl: input.gatewayUrl ?? null,
        status: input.status ?? "disconnected",
        syncMode: input.syncMode ?? "manual",
        hasGatewayToken: input.hasGatewayToken ?? false,
        meta: input.meta ? toJsonObject(input.meta) : null,
        lastSyncedAt: input.lastSyncedAt ?? null,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning()
      .get();

    if (inserted) {
      return { connection: inserted, created: true };
    }

    // Row already existed — update it selectively within the same transaction.
    const existing = tx
      .select()
      .from(openclawConnections)
      .where(eq(openclawConnections.rootPath, input.rootPath))
      .get();

    if (!existing) {
      // Should be unreachable — conflict means the row exists.
      throw new Error(`Unexpected state: conflict on rootPath "${input.rootPath}" but no existing row found`);
    }

    const updated = tx
      .update(openclawConnections)
      .set({
        name: input.name,
        gatewayUrl: input.gatewayUrl !== undefined ? input.gatewayUrl : existing.gatewayUrl,
        status: input.status ?? existing.status,
        syncMode: input.syncMode ?? existing.syncMode,
        hasGatewayToken: input.hasGatewayToken !== undefined ? input.hasGatewayToken : existing.hasGatewayToken,
        meta: input.meta ? toJsonObject(input.meta) : existing.meta,
        lastSyncedAt: input.lastSyncedAt !== undefined ? input.lastSyncedAt : existing.lastSyncedAt,
        updatedAt: now,
      })
      .where(eq(openclawConnections.id, existing.id))
      .returning()
      .get();

    return { connection: updated, created: false };
  });
}

export function updateOpenClawConnection(
  db: DB,
  id: string,
  updates: UpdateOpenClawConnectionInput,
): OpenClawConnection | null {
  const existing = getOpenClawConnection(db, id);
  if (!existing) {
    return null;
  }

  return db
    .update(openclawConnections)
    .set({
      name: updates.name ?? existing.name,
      gatewayUrl:
        updates.gatewayUrl === undefined ? existing.gatewayUrl : updates.gatewayUrl,
      status: updates.status ?? existing.status,
      syncMode: updates.syncMode ?? existing.syncMode,
      hasGatewayToken: updates.hasGatewayToken ?? existing.hasGatewayToken,
      meta: updates.meta ? toJsonObject(updates.meta) : existing.meta,
      lastSyncedAt:
        updates.lastSyncedAt === undefined
          ? existing.lastSyncedAt
          : updates.lastSyncedAt,
      updatedAt: new Date(),
    })
    .where(eq(openclawConnections.id, id))
    .returning()
    .get();
}
