import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const IDEA_SECTIONS_HASH = "e41138c176195c146f4054465b896043c989b80508f1e6efaa9a1a4858e7e7e8";
const FUTURE_MIGRATION_TIMESTAMP = 1773900000000;

function clearCoreModuleCaches() {
  for (const modulePath of ["../dist/db.js", "../dist/migrate.js"]) {
    delete require.cache[require.resolve(modulePath)];
  }
}

function seedBrokenDatabase(dbPath) {
  const sqlite = new Database(dbPath);

  sqlite.exec(`
    create table __drizzle_migrations (
      id integer primary key autoincrement,
      hash text not null,
      created_at integer not null
    );

    create table openclaw_connections (
      id text primary key not null
    );

    create table openclaw_agents (
      id text primary key not null
    );

    create table agents (
      id text primary key not null
    );

    create table openclaw_sessions (
      id text primary key not null
    );
  `);

  sqlite
    .prepare("insert into __drizzle_migrations (hash, created_at) values (?, ?)")
    .run(IDEA_SECTIONS_HASH, FUTURE_MIGRATION_TIMESTAMP);

  sqlite.close();
}

describe("runMigrations", () => {
  it("repairs session usage tables when the migration journal skips 0022", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawops-core-migrate-"));
    const dbPath = path.join(tempDir, "test.db");
    const previousDbPath = process.env.CLAWOPS_DB_PATH;

    try {
      seedBrokenDatabase(dbPath);
      process.env.CLAWOPS_DB_PATH = dbPath;
      clearCoreModuleCaches();

      const { runMigrations } = require("../dist/migrate.js");

      runMigrations();
      runMigrations();

      const sqlite = new Database(dbPath, { readonly: true });
      const tableNames = sqlite
        .prepare(`
          select name
          from sqlite_master
          where type = 'table'
            and name in ('openclaw_session_usage_entries', 'openclaw_session_usage_cursors')
          order by name
        `)
        .all()
        .map((row) => row.name);

      sqlite.close();

      assert.deepEqual(tableNames, [
        "openclaw_session_usage_cursors",
        "openclaw_session_usage_entries",
      ]);
    } finally {
      clearCoreModuleCaches();
      if (previousDbPath === undefined) {
        delete process.env.CLAWOPS_DB_PATH;
      } else {
        process.env.CLAWOPS_DB_PATH = previousDbPath;
      }
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
