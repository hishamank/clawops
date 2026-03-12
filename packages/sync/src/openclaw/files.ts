import {
  and,
  asc,
  desc,
  eq,
  lt,
  openclawConnections,
  parseJsonObject,
  sql,
  workspaceFileRevisions,
  workspaceFiles,
  type DB,
  type OpenClawConnection,
  type WorkspaceFile,
  type WorkspaceFileRevision,
} from "@clawops/core";

type TransactionDb = Parameters<DB["transaction"]>[0] extends (tx: infer T) => unknown ? T : DB;

export interface OpenClawWorkspaceFile {
  workspacePath: string;
  relativePath: string;
  fileHash: string | null;
  sizeBytes: number | null;
  gitCommitSha?: string | null;
  gitBranch?: string | null;
}

export interface WorkspaceFileChange {
  file: WorkspaceFile;
  previousHash: string | null;
  changed: boolean;
}

export interface WorkspaceFileSyncResult {
  fetchedCount: number;
  inserted: WorkspaceFile[];
  updated: WorkspaceFileChange[];
  unchangedCount: number;
}

const WORKSPACE_FILES_FETCH_TIMEOUT_MS = 30_000;

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeWorkspaceFile(record: unknown): OpenClawWorkspaceFile | null {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return null;
  }

  const raw = record as Record<string, unknown>;
  const workspacePath = toNullableString(
    raw["workspacePath"] ?? raw["workspace_root"] ?? raw["rootPath"] ?? raw["workspace"],
  );
  const relativePath = toNullableString(
    raw["relativePath"] ?? raw["relative_path"] ?? raw["path"] ?? raw["filePath"],
  );

  if (!workspacePath || !relativePath) {
    return null;
  }

  return {
    workspacePath,
    relativePath,
    fileHash: toNullableString(raw["fileHash"] ?? raw["file_hash"] ?? raw["hash"] ?? raw["sha256"]),
    sizeBytes: toNullableNumber(raw["sizeBytes"] ?? raw["size_bytes"] ?? raw["size"] ?? raw["bytes"]),
    gitCommitSha: toNullableString(raw["gitCommitSha"] ?? raw["git_commit_sha"] ?? raw["commitSha"]),
    gitBranch: toNullableString(raw["gitBranch"] ?? raw["git_branch"] ?? raw["branch"]),
  };
}

function normalizeWorkspaceFileResponse(data: unknown): OpenClawWorkspaceFile[] {
  const container =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  const rawFiles: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(container?.["files"])
      ? (container["files"] as unknown[])
      : Array.isArray(container?.["items"])
        ? (container["items"] as unknown[])
        : [];

  const normalized = new Map<string, OpenClawWorkspaceFile>();
  for (const record of rawFiles) {
    const file = normalizeWorkspaceFile(record);
    if (!file) {
      continue;
    }
    normalized.set(file.relativePath, file);
  }

  return [...normalized.values()];
}

export async function fetchWorkspaceFiles(
  gatewayUrl: string,
  token: string,
): Promise<OpenClawWorkspaceFile[]> {
  const url = new URL("/api/workspace/files", gatewayUrl).toString();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(WORKSPACE_FILES_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch workspace files from ${url}: ${response.status}`);
  }

  const data = (await response.json()) as unknown;
  return normalizeWorkspaceFileResponse(data);
}

export function upsertWorkspaceFiles(
  db: DB,
  connectionId: string,
  files: OpenClawWorkspaceFile[],
): WorkspaceFileSyncResult {
  return db.transaction((tx: TransactionDb) => {
    const syncStartedAt = new Date();
    const existingRows = tx
      .select()
      .from(workspaceFiles)
      .where(eq(workspaceFiles.connectionId, connectionId))
      .all();
    const existingByRelativePath = new Map(existingRows.map((row) => [row.relativePath, row]));
    const uniqueFiles = new Map<string, OpenClawWorkspaceFile>();

    for (const file of files) {
      uniqueFiles.set(file.relativePath, file);
    }

    const inserted: WorkspaceFile[] = [];
    const updated: WorkspaceFileChange[] = [];
    const rowsToUpsert = [];
    const changedRelativePaths = new Set<string>();

    for (const file of uniqueFiles.values()) {
      const current = existingByRelativePath.get(file.relativePath);
      const nextHash = file.fileHash ?? null;
      const nextSize = file.sizeBytes ?? null;

      const changed =
        !current ||
        current.workspacePath !== file.workspacePath ||
        (current.fileHash ?? null) !== nextHash ||
        (current.sizeBytes ?? null) !== nextSize;

      if (changed) {
        changedRelativePaths.add(file.relativePath);
      }

      rowsToUpsert.push({
        connectionId,
        workspacePath: file.workspacePath,
        relativePath: file.relativePath,
        fileHash: nextHash,
        sizeBytes: nextSize,
        lastSeenAt: syncStartedAt,
        createdAt: current?.createdAt ?? syncStartedAt,
        updatedAt: syncStartedAt,
      });
    }

    const upsertedRows =
      rowsToUpsert.length === 0
        ? []
        : tx
            .insert(workspaceFiles)
            .values(rowsToUpsert)
            .onConflictDoUpdate({
              target: [workspaceFiles.connectionId, workspaceFiles.relativePath],
              set: {
                workspacePath: sql.raw(`excluded.${workspaceFiles.workspacePath.name}`),
                fileHash: sql.raw(`excluded.${workspaceFiles.fileHash.name}`),
                sizeBytes: sql.raw(`excluded.${workspaceFiles.sizeBytes.name}`),
                lastSeenAt: sql.raw(`excluded.${workspaceFiles.lastSeenAt.name}`),
                updatedAt: sql`
                  case
                    when ${workspaceFiles.workspacePath} is not excluded.${sql.raw(workspaceFiles.workspacePath.name)}
                      or ${workspaceFiles.fileHash} is not excluded.${sql.raw(workspaceFiles.fileHash.name)}
                      or ${workspaceFiles.sizeBytes} is not excluded.${sql.raw(workspaceFiles.sizeBytes.name)}
                    then excluded.${sql.raw(workspaceFiles.updatedAt.name)}
                    else ${workspaceFiles.updatedAt}
                  end
                `,
              },
            })
            .returning()
            .all();
    const upsertedByRelativePath = new Map(upsertedRows.map((row) => [row.relativePath, row]));

    for (const file of uniqueFiles.values()) {
      const row = upsertedByRelativePath.get(file.relativePath);
      if (!row) {
        continue;
      }

      const previous = existingByRelativePath.get(file.relativePath);
      if (!previous) {
        inserted.push(row);
        continue;
      }

      if (!changedRelativePaths.has(file.relativePath)) {
        continue;
      }

      updated.push({
        file: row,
        previousHash: previous.fileHash ?? null,
        changed: (previous.fileHash ?? null) !== (file.fileHash ?? null),
      });
    }

    const revisionRows: typeof workspaceFileRevisions.$inferInsert[] = [];
    for (const row of inserted) {
      const file = uniqueFiles.get(row.relativePath);
      revisionRows.push({
        workspaceFileId: row.id,
        hash: row.fileHash ?? null,
        sizeBytes: row.sizeBytes ?? null,
        gitCommitSha: file?.gitCommitSha ?? null,
        gitBranch: file?.gitBranch ?? null,
        source: "sync" as const,
        capturedAt: syncStartedAt,
      });
    }
    for (const change of updated) {
      const file = uniqueFiles.get(change.file.relativePath);
      revisionRows.push({
        workspaceFileId: change.file.id,
        hash: change.file.fileHash ?? null,
        sizeBytes: change.file.sizeBytes ?? null,
        gitCommitSha: file?.gitCommitSha ?? null,
        gitBranch: file?.gitBranch ?? null,
        source: "sync" as const,
        capturedAt: syncStartedAt,
      });
    }

    if (revisionRows.length > 0) {
      tx.insert(workspaceFileRevisions).values(revisionRows).run();
    }

    tx.delete(workspaceFiles)
      .where(
        and(
          eq(workspaceFiles.connectionId, connectionId),
          lt(workspaceFiles.lastSeenAt, syncStartedAt),
        ),
      )
      .run();

    const unchangedCount = uniqueFiles.size - inserted.length - updated.length;

    if (unchangedCount < 0) {
      throw new Error(`Workspace file sync produced an invalid unchanged count for ${connectionId}`);
    }

    return {
      fetchedCount: uniqueFiles.size,
      inserted,
      updated,
      unchangedCount,
    };
  });
}

export function listWorkspaceFileRevisions(
  db: DB,
  workspaceFileId: string,
  opts?: { limit?: number },
): WorkspaceFileRevision[] {
  const base = db
    .select()
    .from(workspaceFileRevisions)
    .where(eq(workspaceFileRevisions.workspaceFileId, workspaceFileId))
    .orderBy(desc(workspaceFileRevisions.capturedAt), asc(workspaceFileRevisions.id));

  if (typeof opts?.limit === "number" && opts.limit > 0) {
    return base.limit(opts.limit).all();
  }

  return base.all();
}

function resolveGatewayToken(connection: OpenClawConnection): string | null {
  const meta = parseJsonObject(connection.meta);
  const token = meta["gatewayToken"];
  if (typeof token === "string" && token.trim()) {
    return token.trim();
  }

  const envToken = process.env["OPENCLAW_GATEWAY_TOKEN"];
  return envToken?.trim() ? envToken.trim() : null;
}

export async function syncWorkspaceFiles(
  db: DB,
  connection: OpenClawConnection,
): Promise<WorkspaceFileSyncResult> {
  if (!connection.gatewayUrl) {
    throw new Error(`Connection ${connection.id} is missing a gateway URL`);
  }

  const token = resolveGatewayToken(connection);
  if (!token) {
    throw new Error(
      `Connection ${connection.id} has no gateway token available in meta.gatewayToken or OPENCLAW_GATEWAY_TOKEN`,
    );
  }

  const files = await fetchWorkspaceFiles(connection.gatewayUrl, token);
  const result = upsertWorkspaceFiles(db, connection.id, files);
  const now = new Date();

  db.update(openclawConnections)
    .set({
      lastSyncedAt: now,
      updatedAt: now,
    })
    .where(eq(openclawConnections.id, connection.id))
    .run();

  return result;
}
