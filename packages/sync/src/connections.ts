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
  const existing = getOpenClawConnectionByRootPath(db, input.rootPath);

  if (existing) {
    const connection = db
      .update(openclawConnections)
      .set({
        name: input.name,
        gatewayUrl: input.gatewayUrl ?? existing.gatewayUrl,
        status: input.status ?? existing.status,
        syncMode: input.syncMode ?? existing.syncMode,
        hasGatewayToken: input.hasGatewayToken ?? existing.hasGatewayToken,
        meta: input.meta ? toJsonObject(input.meta) : existing.meta,
        lastSyncedAt:
          input.lastSyncedAt === undefined
            ? existing.lastSyncedAt
            : input.lastSyncedAt,
        updatedAt: new Date(),
      })
      .where(eq(openclawConnections.id, existing.id))
      .returning()
      .get();

    return { connection, created: false };
  }

  const connection = db
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
      updatedAt: new Date(),
    })
    .returning()
    .get();

  return { connection, created: true };
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
