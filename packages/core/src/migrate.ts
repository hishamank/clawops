import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./db.js";

export function runMigrations(): void {
  const migrationsFolder = path.resolve(__dirname, "../migrations");
  migrate(db, { migrationsFolder });
}
