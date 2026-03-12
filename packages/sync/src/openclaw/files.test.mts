import assert from "node:assert";
import { describe, it, mock } from "node:test";

interface WorkspaceFileRow {
  id: string;
  connectionId: string;
  workspacePath: string;
  relativePath: string;
  fileHash: string | null;
  sizeBytes: number | null;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface RevisionRow {
  workspaceFileId: string;
  hash: string | null;
  sizeBytes: number | null;
  gitCommitSha: string | null;
  gitBranch: string | null;
  source: string;
  capturedAt: Date;
}

const workspaceFileTable = {
  connectionId: { name: "connection_id" },
  workspacePath: { name: "workspace_path" },
  relativePath: { name: "relative_path" },
  fileHash: { name: "file_hash" },
  sizeBytes: { name: "size_bytes" },
  lastSeenAt: { name: "last_seen_at" },
  updatedAt: { name: "updated_at" },
};

const workspaceFileRevisionsTable = {
  workspaceFileId: { name: "workspace_file_id" },
  capturedAt: { name: "captured_at" },
};

mock.module("@clawops/core", {
  namedExports: {
    and: (...conditions: unknown[]) => ({ type: "and", conditions }),
    eq: (left: unknown, right: unknown) => ({ type: "eq", left, right }),
    lt: (left: unknown, right: unknown) => ({ type: "lt", left, right }),
    asc: (col: unknown) => ({ type: "asc", col }),
    desc: (col: unknown) => ({ type: "desc", col }),
    sql: Object.assign(
      (strings: TemplateStringsArray, ...values: unknown[]) => ({
        type: "sql",
        text: strings.join("?"),
        values,
      }),
      {
        raw: (value: string) => ({ type: "raw", value }),
      },
    ),
    openclawConnections: {
      id: { name: "id" },
    },
    parseJsonObject: (value: string | null) => (value ? JSON.parse(value) : {}),
    workspaceFiles: workspaceFileTable,
    workspaceFileRevisions: workspaceFileRevisionsTable,
  },
});

const { upsertWorkspaceFiles, listWorkspaceFileRevisions } = await import("./files.js");

function createDb(initialRows: WorkspaceFileRow[] = []) {
  const rows = [...initialRows];
  const revisions: RevisionRow[] = [];
  let currentInsertTarget: "files" | "revisions" = "files";

  const dbObj = {
    transaction<T>(callback: (tx: typeof dbObj) => T): T {
      return callback(this);
    },
    select() {
      return {
        from(table: unknown) {
          const isRevisions = table === workspaceFileRevisionsTable;
          return {
            where(condition: { type: string; left: unknown; right: unknown }) {
              return {
                orderBy() {
                  return {
                    limit(_n: number) {
                      return {
                        all() {
                          if (isRevisions) {
                            const fileId = condition.right;
                            return [...revisions]
                              .filter((r) => r.workspaceFileId === fileId)
                              .sort(
                                (a, b) =>
                                  b.capturedAt.getTime() - a.capturedAt.getTime(),
                              );
                          }
                          return rows.map((row) => ({ ...row }));
                        },
                      };
                    },
                    all() {
                      if (isRevisions) {
                        const fileId = condition.right;
                        return [...revisions]
                          .filter((r) => r.workspaceFileId === fileId)
                          .sort(
                            (a, b) =>
                              b.capturedAt.getTime() - a.capturedAt.getTime(),
                          );
                      }
                      return rows.map((row) => ({ ...row }));
                    },
                  };
                },
                all() {
                  return rows.map((row) => ({ ...row }));
                },
              };
            },
          };
        },
      };
    },
    insert(table?: unknown) {
      currentInsertTarget =
        table === workspaceFileRevisionsTable ? "revisions" : "files";

      let valuesToInsert: unknown[] = [];

      return {
        values(values: unknown[]) {
          valuesToInsert = values;
          return this;
        },
        onConflictDoUpdate() {
          return this;
        },
        run() {
          if (currentInsertTarget === "revisions") {
            for (const value of valuesToInsert) {
              revisions.push(value as RevisionRow);
            }
          }
        },
        returning() {
          return {
            all() {
              const upserted: WorkspaceFileRow[] = [];

              for (const value of valuesToInsert as Array<
                Omit<WorkspaceFileRow, "id">
              >) {
                const existing = rows.find(
                  (row) =>
                    row.connectionId === value.connectionId &&
                    row.relativePath === value.relativePath,
                );

                if (existing) {
                  const changed =
                    existing.workspacePath !== value.workspacePath ||
                    existing.fileHash !== value.fileHash ||
                    existing.sizeBytes !== value.sizeBytes;

                  existing.workspacePath = value.workspacePath;
                  existing.fileHash = value.fileHash;
                  existing.sizeBytes = value.sizeBytes;
                  existing.lastSeenAt = value.lastSeenAt;
                  if (changed) {
                    existing.updatedAt = value.updatedAt;
                  }
                  upserted.push({ ...existing });
                  continue;
                }

                const created: WorkspaceFileRow = {
                  id: `row-${value.relativePath}`,
                  ...value,
                };
                rows.push(created);
                upserted.push({ ...created });
              }

              return upserted;
            },
          };
        },
      };
    },
    delete() {
      return {
        where() {
          return {
            run() {
              const latestSeenAtByConnection = new Map<string, number>();

              for (const row of rows) {
                const seenAt = row.lastSeenAt.getTime();
                const current =
                  latestSeenAtByConnection.get(row.connectionId) ??
                  Number.NEGATIVE_INFINITY;
                if (seenAt > current) {
                  latestSeenAtByConnection.set(row.connectionId, seenAt);
                }
              }

              for (let index = rows.length - 1; index >= 0; index -= 1) {
                const row = rows[index];
                if (!row) {
                  continue;
                }
                const latestSeenAt = latestSeenAtByConnection.get(
                  row.connectionId,
                );
                if (latestSeenAt && row.lastSeenAt.getTime() < latestSeenAt) {
                  rows.splice(index, 1);
                }
              }
            },
          };
        },
      };
    },
    rows,
    revisions,
  };

  return dbObj;
}

describe("upsertWorkspaceFiles", () => {
  it("inserts new workspace files", () => {
    const db = createDb();

    const result = upsertWorkspaceFiles(db as never, "conn-1", [
      {
        workspacePath: "/tmp/openclaw/workspace-main",
        relativePath: "src/index.ts",
        fileHash: "hash-1",
        sizeBytes: 128,
      },
      {
        workspacePath: "/tmp/openclaw/workspace-main",
        relativePath: "README.md",
        fileHash: "hash-2",
        sizeBytes: 64,
      },
    ]);

    assert.equal(result.fetchedCount, 2);
    assert.equal(result.inserted.length, 2);
    assert.equal(result.updated.length, 0);
    assert.equal(result.unchangedCount, 0);
    assert.equal(db.rows.length, 2);
  });

  it("updates files when the hash changes", () => {
    const originalSeenAt = new Date("2026-03-10T10:00:00.000Z");
    const db = createDb([
      {
        id: "row-src/index.ts",
        connectionId: "conn-1",
        workspacePath: "/tmp/openclaw/workspace-main",
        relativePath: "src/index.ts",
        fileHash: "hash-old",
        sizeBytes: 128,
        lastSeenAt: originalSeenAt,
        createdAt: originalSeenAt,
        updatedAt: originalSeenAt,
      },
    ]);

    const result = upsertWorkspaceFiles(db as never, "conn-1", [
      {
        workspacePath: "/tmp/openclaw/workspace-main",
        relativePath: "src/index.ts",
        fileHash: "hash-new",
        sizeBytes: 256,
      },
    ]);

    assert.equal(result.inserted.length, 0);
    assert.equal(result.updated.length, 1);
    assert.equal(result.updated[0]?.previousHash, "hash-old");
    assert.equal(result.updated[0]?.changed, true);
    assert.equal(db.rows[0]?.fileHash, "hash-new");
    assert.equal(db.rows[0]?.sizeBytes, 256);
    assert.ok(db.rows[0]);
    assert.ok(db.rows[0].updatedAt.getTime() > originalSeenAt.getTime());
    assert.equal(result.unchangedCount, 0);
  });

  it("deletes stale files that were not seen in the current sync", () => {
    const staleSeenAt = new Date("2026-03-09T10:00:00.000Z");
    const db = createDb([
      {
        id: "row-src/keep.ts",
        connectionId: "conn-1",
        workspacePath: "/tmp/openclaw/workspace-main",
        relativePath: "src/keep.ts",
        fileHash: "hash-keep",
        sizeBytes: 100,
        lastSeenAt: staleSeenAt,
        createdAt: staleSeenAt,
        updatedAt: staleSeenAt,
      },
      {
        id: "row-src/remove.ts",
        connectionId: "conn-1",
        workspacePath: "/tmp/openclaw/workspace-main",
        relativePath: "src/remove.ts",
        fileHash: "hash-remove",
        sizeBytes: 200,
        lastSeenAt: staleSeenAt,
        createdAt: staleSeenAt,
        updatedAt: staleSeenAt,
      },
    ]);

    const result = upsertWorkspaceFiles(db as never, "conn-1", [
      {
        workspacePath: "/tmp/openclaw/workspace-main",
        relativePath: "src/keep.ts",
        fileHash: "hash-keep",
        sizeBytes: 100,
      },
    ]);

    assert.equal(result.fetchedCount, 1);
    assert.equal(result.inserted.length, 0);
    assert.equal(result.updated.length, 0);
    assert.equal(result.unchangedCount, 1);
    assert.deepEqual(
      db.rows.map((row) => row.relativePath),
      ["src/keep.ts"],
    );
  });
});

describe("workspace file revisions", () => {
  it("creates revision records when files are inserted", () => {
    const db = createDb();

    upsertWorkspaceFiles(db as never, "conn-1", [
      {
        workspacePath: "/tmp/openclaw/workspace-main",
        relativePath: "src/index.ts",
        fileHash: "hash-1",
        sizeBytes: 128,
        gitCommitSha: "abc123",
        gitBranch: "main",
      },
    ]);

    assert.equal(db.revisions.length, 1);
    assert.equal(db.revisions[0]?.workspaceFileId, "row-src/index.ts");
    assert.equal(db.revisions[0]?.hash, "hash-1");
    assert.equal(db.revisions[0]?.sizeBytes, 128);
    assert.equal(db.revisions[0]?.gitCommitSha, "abc123");
    assert.equal(db.revisions[0]?.gitBranch, "main");
    assert.equal(db.revisions[0]?.source, "sync");
  });

  it("creates revision records when files are updated (hash changed)", () => {
    const originalSeenAt = new Date("2026-03-10T10:00:00.000Z");
    const db = createDb([
      {
        id: "row-src/index.ts",
        connectionId: "conn-1",
        workspacePath: "/tmp/openclaw/workspace-main",
        relativePath: "src/index.ts",
        fileHash: "hash-old",
        sizeBytes: 128,
        lastSeenAt: originalSeenAt,
        createdAt: originalSeenAt,
        updatedAt: originalSeenAt,
      },
    ]);

    upsertWorkspaceFiles(db as never, "conn-1", [
      {
        workspacePath: "/tmp/openclaw/workspace-main",
        relativePath: "src/index.ts",
        fileHash: "hash-new",
        sizeBytes: 256,
        gitCommitSha: "def456",
        gitBranch: "feature-x",
      },
    ]);

    assert.equal(db.revisions.length, 1);
    assert.equal(db.revisions[0]?.hash, "hash-new");
    assert.equal(db.revisions[0]?.sizeBytes, 256);
    assert.equal(db.revisions[0]?.gitCommitSha, "def456");
    assert.equal(db.revisions[0]?.gitBranch, "feature-x");
  });

  it("does NOT create revision records for unchanged files", () => {
    const originalSeenAt = new Date("2026-03-10T10:00:00.000Z");
    const db = createDb([
      {
        id: "row-src/index.ts",
        connectionId: "conn-1",
        workspacePath: "/tmp/openclaw/workspace-main",
        relativePath: "src/index.ts",
        fileHash: "hash-1",
        sizeBytes: 128,
        lastSeenAt: originalSeenAt,
        createdAt: originalSeenAt,
        updatedAt: originalSeenAt,
      },
    ]);

    upsertWorkspaceFiles(db as never, "conn-1", [
      {
        workspacePath: "/tmp/openclaw/workspace-main",
        relativePath: "src/index.ts",
        fileHash: "hash-1",
        sizeBytes: 128,
      },
    ]);

    assert.equal(db.revisions.length, 0);
  });

  it("listWorkspaceFileRevisions returns revisions in descending capturedAt order", () => {
    const db = createDb();
    const earlier = new Date("2026-03-10T10:00:00.000Z");
    const later = new Date("2026-03-11T10:00:00.000Z");

    db.revisions.push(
      {
        workspaceFileId: "file-1",
        hash: "hash-old",
        sizeBytes: 100,
        gitCommitSha: null,
        gitBranch: null,
        source: "sync",
        capturedAt: earlier,
      },
      {
        workspaceFileId: "file-1",
        hash: "hash-new",
        sizeBytes: 200,
        gitCommitSha: "abc123",
        gitBranch: "main",
        source: "sync",
        capturedAt: later,
      },
    );

    const result = listWorkspaceFileRevisions(db as never, "file-1");

    assert.equal(result.length, 2);
    assert.equal(result[0]?.hash, "hash-new");
    assert.equal(result[1]?.hash, "hash-old");
  });

  it("listWorkspaceFileRevisions returns stable order when multiple revisions share the same capturedAt", () => {
    const db = createDb();
    const sameTimestamp = new Date("2026-03-12T10:00:00.000Z");

    db.revisions.push(
      { workspaceFileId: "file-1", hash: "hash-a", sizeBytes: 100, gitCommitSha: null, gitBranch: null, source: "sync" as const, capturedAt: sameTimestamp },
      { workspaceFileId: "file-1", hash: "hash-b", sizeBytes: 200, gitCommitSha: null, gitBranch: null, source: "sync" as const, capturedAt: sameTimestamp },
      { workspaceFileId: "file-1", hash: "hash-c", sizeBytes: 300, gitCommitSha: null, gitBranch: null, source: "sync" as const, capturedAt: sameTimestamp },
    );

    const resultA = listWorkspaceFileRevisions(db as never, "file-1");
    const resultB = listWorkspaceFileRevisions(db as never, "file-1");

    // Order must be deterministic across repeated calls
    assert.equal(resultA.length, 3);
    assert.deepEqual(
      resultA.map((r) => r.hash),
      resultB.map((r) => r.hash),
    );
  });
});
