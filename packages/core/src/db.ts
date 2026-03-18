import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import path from "node:path";

const dbPath = process.env["CLAWOPS_DB_PATH"] || "./clawops.db";

// Resolve the native binding explicitly so webpack bundling can't break the path.
// When Next.js bundles @clawops/core, the `bindings` package uses __dirname of
// the bundle (not the actual package) and fails to find better_sqlite3.node.
// Passing `nativeBinding` as an absolute path bypasses that lookup entirely.
// The env var BETTER_SQLITE3_NATIVE allows the startup script to inject the real path.
function resolveNativeBinding(): string | undefined {
  // Prefer an explicit env override (set by the startup script)
  const envPath = process.env["BETTER_SQLITE3_NATIVE"];
  if (envPath) return envPath;
  // Fallback: try normal require.resolve (works outside webpack context)
  try {
    const pkgDir = path.dirname(require.resolve("better-sqlite3/package.json"));
    return path.join(pkgDir, "build", "Release", "better_sqlite3.node");
  } catch {
    return undefined;
  }
}

const sqlite = new Database(dbPath, { nativeBinding: resolveNativeBinding() } as Parameters<typeof Database>[1]);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;

export type TransactionDb = Parameters<DB["transaction"]>[0] extends (tx: infer T) => unknown ? T : DB;
export type DBOrTx = DB | TransactionDb;
