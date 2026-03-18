import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

const dbPath = process.env["CLAWOPS_DB_PATH"]?.trim() || "./clawops.db";

if (!dbPath || typeof dbPath !== "string") {
  throw new Error(
    `Invalid CLAWOPS_DB_PATH: got ${JSON.stringify(dbPath)} (type: ${typeof dbPath}). ` +
    `Expected a valid file path string. Check your .env file.`
  );
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;

export type TransactionDb = Parameters<DB["transaction"]>[0] extends (tx: infer T) => unknown ? T : DB;
export type DBOrTx = DB | TransactionDb;
