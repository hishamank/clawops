import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./db.js";

const SESSION_USAGE_TABLES = [
  "openclaw_session_usage_entries",
  "openclaw_session_usage_cursors",
] as const;

function getSqliteClient(): Database.Database {
  return (db as { $client: Database.Database }).$client;
}

function hasTable(tableName: string): boolean {
  const row = getSqliteClient()
    .prepare("select name from sqlite_master where type = 'table' and name = ?")
    .get(tableName) as { name?: string } | undefined;

  return row?.name === tableName;
}

function ensureSessionUsageSchema(migrationsFolder: string): void {
  if (SESSION_USAGE_TABLES.every((tableName) => hasTable(tableName))) {
    return;
  }

  const migrationSql = fs.readFileSync(
    path.join(migrationsFolder, "0022_openclaw_session_usage.sql"),
    "utf8",
  );

  getSqliteClient().exec(migrationSql);
}

export function runMigrations(): void {
  const migrationsFolder = path.resolve(__dirname, "../migrations");
  migrate(db, { migrationsFolder });
  ensureSessionUsageSchema(migrationsFolder);
}
