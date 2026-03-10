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

function buildConnectionUpdateValues(
  input: UpsertOpenClawConnectionInput | UpdateOpenClawConnectionInput,
  existing: OpenClawConnection,
): Pick<
  OpenClawConnection,
  "name" | "gatewayUrl" | "status" | "syncMode" | "hasGatewayToken" | "meta" | "lastSyncedAt"
> & { updatedAt: Date } {
  return {
    name: input.name ?? existing.name,
    gatewayUrl:
      input.gatewayUrl === undefined ? existing.gatewayUrl : input.gatewayUrl,
    status: input.status ?? existing.status,
    syncMode: input.syncMode ?? existing.syncMode,
    hasGatewayToken: input.hasGatewayToken ?? existing.hasGatewayToken,
    meta: input.meta ? toJsonObject(input.meta) : existing.meta,
    lastSyncedAt:
      input.lastSyncedAt === undefined
        ? existing.lastSyncedAt
        : input.lastSyncedAt,
    updatedAt: new Date(),
  };
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

    const existing = tx
      .select()
      .from(openclawConnections)
      .where(eq(openclawConnections.rootPath, input.rootPath))
      .get();
    if (!existing) {
      throw new Error(
        `Unexpected state: conflict on rootPath "${input.rootPath}" but no existing row found`,
      );
    }

    const connection = tx
      .update(openclawConnections)
      .set({
        ...buildConnectionUpdateValues(input, existing),
        updatedAt: now,
      })
      .where(eq(openclawConnections.id, existing.id))
      .returning()
      .get();

    return { connection, created: false };
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
    .set(buildConnectionUpdateValues(updates, existing))
    .where(eq(openclawConnections.id, id))
    .returning()
    .get();
}
