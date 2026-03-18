import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./db.js";

export function runMigrations(): void {
  // When bundled by webpack (Next.js), __dirname points to the bundle directory, not the
  // actual package root. Use CLAWOPS_MIGRATIONS_DIR env var to override if needed.
  const migrationsFolder =
    process.env["CLAWOPS_MIGRATIONS_DIR"] ??
    path.resolve(__dirname, "../migrations");
  migrate(db, { migrationsFolder });
}
