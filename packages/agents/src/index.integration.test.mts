import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DB } from "@clawops/core";
import * as schema from "@clawops/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  getAgentByOpenClawIdentity,
  getOpenClawAgentMapping,
  initAgent,
  listAgents,
} = await import("../dist/index.js");

let db: DB;

beforeEach(() => {
  const sqlite = new Database(":memory:");
  db = drizzle(sqlite, { schema }) as DB;
  migrate(db, {
    migrationsFolder: path.resolve(__dirname, "../../core/migrations"),
  });
});

function createConnection(rootPath: string) {
  return db
    .insert(schema.openclawConnections)
    .values({
      name: "Local OpenClaw",
      rootPath,
      gatewayUrl: "http://localhost:3000",
      status: "active",
      syncMode: "manual",
      hasGatewayToken: false,
      updatedAt: new Date(),
    })
    .returning()
    .get();
}

describe("OpenClaw durable identity mapping", () => {
  it("reuses the same ClawOps agent when the OpenClaw name changes", () => {
    const connection = createConnection("/tmp/openclaw-rename");

    const initial = initAgent(db, {
      name: "Alpha",
      model: "claude-opus",
      role: "builder",
      framework: "openclaw",
      memoryPath: "/tmp/openclaw-rename/workspace-alpha",
      openclaw: {
        connectionId: connection.id,
        externalAgentId: "alpha-id",
        externalAgentName: "Alpha",
        workspacePath: "/tmp/openclaw-rename/workspace-alpha",
        memoryPath: "/tmp/openclaw-rename/workspace-alpha",
        defaultModel: "claude-opus",
        role: "builder",
      },
    });

    const renamed = initAgent(db, {
      name: "Alpha Prime",
      model: "claude-opus",
      role: "builder",
      framework: "openclaw",
      memoryPath: "/tmp/openclaw-rename/workspace-alpha-prime",
      openclaw: {
        connectionId: connection.id,
        externalAgentId: "alpha-id",
        externalAgentName: "Alpha Prime",
        workspacePath: "/tmp/openclaw-rename/workspace-alpha-prime",
        memoryPath: "/tmp/openclaw-rename/workspace-alpha-prime",
        defaultModel: "claude-opus",
        role: "builder",
      },
    });

    const linked = getAgentByOpenClawIdentity(db, {
      connectionId: connection.id,
      externalAgentId: "alpha-id",
    });
    const mapping = getOpenClawAgentMapping(db, connection.id, "alpha-id");

    assert.equal(initial.created, true);
    assert.equal(renamed.created, false);
    assert.equal(renamed.agent.id, initial.agent.id);
    assert.equal(linked?.id, initial.agent.id);
    assert.equal(linked?.name, "Alpha Prime");
    assert.equal(mapping?.externalAgentName, "Alpha Prime");
    assert.equal(mapping?.workspacePath, "/tmp/openclaw-rename/workspace-alpha-prime");
    assert.equal(listAgents(db).length, 1);
  });

  it("links a legacy agent by name once, then uses the durable mapping after rename", () => {
    const connection = createConnection("/tmp/openclaw-legacy");

    const legacy = initAgent(db, {
      name: "Bravo",
      model: "gpt-5",
      role: "reviewer",
      framework: "openclaw",
      memoryPath: "/tmp/openclaw-legacy/workspace-bravo",
    });

    const firstMapped = initAgent(db, {
      name: "Bravo",
      model: "gpt-5",
      role: "reviewer",
      framework: "openclaw",
      memoryPath: "/tmp/openclaw-legacy/workspace-bravo",
      openclaw: {
        connectionId: connection.id,
        externalAgentId: "bravo-id",
        externalAgentName: "Bravo",
        workspacePath: "/tmp/openclaw-legacy/workspace-bravo",
        memoryPath: "/tmp/openclaw-legacy/workspace-bravo",
        defaultModel: "gpt-5",
        role: "reviewer",
      },
    });

    const renamed = initAgent(db, {
      name: "Bravo Renamed",
      model: "gpt-5",
      role: "reviewer",
      framework: "openclaw",
      memoryPath: "/tmp/openclaw-legacy/workspace-bravo-renamed",
      openclaw: {
        connectionId: connection.id,
        externalAgentId: "bravo-id",
        externalAgentName: "Bravo Renamed",
        workspacePath: "/tmp/openclaw-legacy/workspace-bravo-renamed",
        memoryPath: "/tmp/openclaw-legacy/workspace-bravo-renamed",
        defaultModel: "gpt-5",
        role: "reviewer",
      },
    });

    assert.equal(legacy.agent.id, firstMapped.agent.id);
    assert.equal(renamed.agent.id, legacy.agent.id);
    assert.equal(listAgents(db).filter((agent) => agent.framework === "openclaw").length, 1);
    assert.equal(
      getAgentByOpenClawIdentity(db, {
        connectionId: connection.id,
        externalAgentId: "bravo-id",
      })?.name,
      "Bravo Renamed",
    );
  });
});
