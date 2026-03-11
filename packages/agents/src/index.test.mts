import assert from "node:assert";
import { describe, it } from "node:test";
import type { Agent, OpenClawAgent } from "@clawops/core";
import { agents, openclawAgents } from "@clawops/core";

const agentModule = await import("../dist/index.js");

type Predicate = { [key: string]: unknown };

function columnKeyToProperty(key: string): string {
  return key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function flattenQueryChunks(chunk: unknown): unknown[] {
  if (!chunk || typeof chunk !== "object" || !("queryChunks" in chunk)) {
    return [chunk];
  }

  return (chunk as { queryChunks: unknown[] }).queryChunks.flatMap((entry) =>
    flattenQueryChunks(entry),
  );
}

function extractConditions(condition: unknown): Predicate {
  if (!condition || typeof condition !== "object" || !("queryChunks" in condition)) {
    return {};
  }

  const predicate: Predicate = {};
  let currentColumn: string | null = null;

  for (const chunk of flattenQueryChunks(condition)) {
    if (!chunk || typeof chunk !== "object") {
      continue;
    }

    if ("name" in chunk && "table" in chunk) {
      currentColumn = String((chunk as { name: string }).name);
      continue;
    }

    if (currentColumn && chunk.constructor?.name === "Param" && "value" in chunk) {
      predicate[currentColumn] = (chunk as { value: unknown }).value;
      currentColumn = null;
    }
  }

  return predicate;
}

function createFakeDb() {
  const state: {
    agents: Agent[];
    mappings: OpenClawAgent[];
    nextAgentId: number;
    nextMappingId: number;
  } = {
    agents: [],
    mappings: [],
    nextAgentId: 1,
    nextMappingId: 1,
  };

  const db = {
    transaction<T>(callback: (tx: typeof db) => T): T {
      return callback(db);
    },
    select(selection?: { agent: typeof agents }) {
      return {
        from(table: unknown) {
          let joinedTable: unknown;
          let conditions: Predicate = {};

          return {
            innerJoin(tableToJoin: unknown) {
              joinedTable = tableToJoin;
              return this;
            },
            where(condition: unknown) {
              conditions = extractConditions(condition);
              return this;
            },
            limit(_count: number) {
              return this;
            },
            all() {
              if (table === agents) {
                return state.agents.filter((agent) =>
                  Object.entries(conditions).every(
                    ([key, value]) => value === undefined || agent[key as keyof Agent] === value,
                  ),
                );
              }

              if (table === openclawAgents && joinedTable === agents && selection?.agent) {
                return state.mappings
                  .filter((mapping) =>
                    Object.entries(conditions).every(
                      ([key, value]) =>
                        value === undefined ||
                        mapping[columnKeyToProperty(key) as keyof OpenClawAgent] === value,
                    ),
                  )
                  .map((mapping) => ({
                    agent: state.agents.find((agent) => agent.id === mapping.linkedAgentId)!,
                  }));
              }

              if (table === openclawAgents) {
                return state.mappings.filter((mapping) =>
                  Object.entries(conditions).every(
                    ([key, value]) =>
                      value === undefined ||
                      mapping[columnKeyToProperty(key) as keyof OpenClawAgent] === value,
                  ),
                );
              }

              return [];
            },
            get() {
              return this.all()[0] ?? null;
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(value: Record<string, unknown>) {
          const insertedValues = value;

          const buildReturning = () => ({
            all() {
              if (table === agents) {
                const agent = {
                  id: `agent-${state.nextAgentId++}`,
                  name: String(insertedValues["name"]),
                  model: String(insertedValues["model"]),
                  role: String(insertedValues["role"]),
                  framework: String(insertedValues["framework"] ?? ""),
                  memoryPath: (insertedValues["memoryPath"] as string | null) ?? null,
                  skills: (insertedValues["skills"] as string | null) ?? null,
                  avatar: (insertedValues["avatar"] as string | null) ?? null,
                  apiKey: String(insertedValues["apiKey"] ?? ""),
                  status: (insertedValues["status"] as Agent["status"]) ?? "offline",
                  lastActive: null,
                  createdAt: new Date(),
                } satisfies Agent;
                state.agents.push(agent);
                return [agent];
              }

              if (table === openclawAgents) {
                const existingIndex = state.mappings.findIndex(
                  (mapping) =>
                    mapping.connectionId === insertedValues["connectionId"] &&
                    mapping.externalAgentId === insertedValues["externalAgentId"],
                );
                const mapping = {
                  id:
                    existingIndex >= 0
                      ? state.mappings[existingIndex]!.id
                      : `mapping-${state.nextMappingId++}`,
                  connectionId: String(insertedValues["connectionId"]),
                  linkedAgentId: String(insertedValues["linkedAgentId"]),
                  externalAgentId: String(insertedValues["externalAgentId"]),
                  externalAgentName: String(insertedValues["externalAgentName"]),
                  workspacePath: (insertedValues["workspacePath"] as string | null) ?? null,
                  memoryPath: (insertedValues["memoryPath"] as string | null) ?? null,
                  defaultModel: (insertedValues["defaultModel"] as string | null) ?? null,
                  role: (insertedValues["role"] as string | null) ?? null,
                  avatar: (insertedValues["avatar"] as string | null) ?? null,
                  lastSeenAt: (insertedValues["lastSeenAt"] as Date | null) ?? null,
                  createdAt:
                    existingIndex >= 0
                      ? state.mappings[existingIndex]!.createdAt
                      : new Date(),
                  updatedAt: (insertedValues["updatedAt"] as Date | null) ?? new Date(),
                } satisfies OpenClawAgent;

                if (existingIndex >= 0) {
                  state.mappings[existingIndex] = mapping;
                } else {
                  state.mappings.push(mapping);
                }

                return [mapping];
              }

              return [];
            },
            get() {
              return this.all()[0] ?? null;
            },
          });

          return {
            onConflictDoUpdate(_config: unknown) {
              return {
                returning: buildReturning,
              };
            },
            returning: buildReturning,
          };
        },
      };
    },
    update(table: unknown) {
      return {
        set(values: Record<string, unknown>) {
          let conditions: Predicate = {};

          return {
            where(condition: unknown) {
              conditions = extractConditions(condition);
              return this;
            },
            returning() {
              return {
                all() {
                  if (table === agents) {
                    const updated = state.agents
                      .filter((agent) =>
                        Object.entries(conditions).every(
                          ([key, value]) =>
                            value === undefined || agent[key as keyof Agent] === value,
                        ),
                      )
                      .map((agent) => Object.assign(agent, values));
                    return updated;
                  }

                  return [];
                },
                get() {
                  return this.all()[0] ?? null;
                },
              };
            },
          };
        },
      };
    },
  };

  return db;
}

describe("OpenClaw durable identity mapping", () => {
  it("reuses the same ClawOps agent when the OpenClaw name changes", () => {
    const db = createFakeDb();
    const connectionId = "conn-1";

    const initial = agentModule.initAgent(db as never, {
      name: "Alpha",
      model: "claude-opus",
      role: "builder",
      framework: "openclaw",
      memoryPath: "/tmp/openclaw-rename/workspace-alpha",
      openclaw: {
        connectionId,
        externalAgentId: "alpha-id",
        externalAgentName: "Alpha",
        workspacePath: "/tmp/openclaw-rename/workspace-alpha",
        memoryPath: "/tmp/openclaw-rename/workspace-alpha",
        defaultModel: "claude-opus",
        role: "builder",
      },
    });

    const renamed = agentModule.initAgent(db as never, {
      name: "Alpha Prime",
      model: "claude-opus",
      role: "builder",
      framework: "openclaw",
      memoryPath: "/tmp/openclaw-rename/workspace-alpha-prime",
      openclaw: {
        connectionId,
        externalAgentId: "alpha-id",
        externalAgentName: "Alpha Prime",
        workspacePath: "/tmp/openclaw-rename/workspace-alpha-prime",
        memoryPath: "/tmp/openclaw-rename/workspace-alpha-prime",
        defaultModel: "claude-opus",
        role: "builder",
      },
    });

    const linked = agentModule.getAgentByOpenClawIdentity(db as never, {
      connectionId,
      externalAgentId: "alpha-id",
    });
    const mapping = agentModule.getOpenClawAgentMapping(db as never, connectionId, "alpha-id");

    assert.equal(initial.created, true);
    assert.equal(renamed.created, false);
    assert.equal(renamed.agent.id, initial.agent.id);
    assert.equal(linked?.id, initial.agent.id);
    assert.equal(linked?.name, "Alpha Prime");
    assert.equal(mapping?.externalAgentName, "Alpha Prime");
    assert.equal(mapping?.workspacePath, "/tmp/openclaw-rename/workspace-alpha-prime");
    assert.equal(agentModule.listAgents(db as never).length, 1);
  });

  it("links a legacy agent by name once, then uses the durable mapping after rename", () => {
    const db = createFakeDb();
    const connectionId = "conn-1";

    const legacy = agentModule.initAgent(db as never, {
      name: "Bravo",
      model: "gpt-5",
      role: "reviewer",
      framework: "openclaw",
      memoryPath: "/tmp/openclaw-legacy/workspace-bravo",
    });

    const firstMapped = agentModule.initAgent(db as never, {
      name: "Bravo",
      model: "gpt-5",
      role: "reviewer",
      framework: "openclaw",
      memoryPath: "/tmp/openclaw-legacy/workspace-bravo",
      openclaw: {
        connectionId,
        externalAgentId: "bravo-id",
        externalAgentName: "Bravo",
        workspacePath: "/tmp/openclaw-legacy/workspace-bravo",
        memoryPath: "/tmp/openclaw-legacy/workspace-bravo",
        defaultModel: "gpt-5",
        role: "reviewer",
      },
    });

    const renamed = agentModule.initAgent(db as never, {
      name: "Bravo Renamed",
      model: "gpt-5",
      role: "reviewer",
      framework: "openclaw",
      memoryPath: "/tmp/openclaw-legacy/workspace-bravo-renamed",
      openclaw: {
        connectionId,
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
    assert.equal(
      agentModule.listAgents(db as never).filter((agent) => agent.framework === "openclaw").length,
      1,
    );
    assert.equal(
      agentModule.getAgentByOpenClawIdentity(db as never, {
        connectionId,
        externalAgentId: "bravo-id",
      })?.name,
      "Bravo Renamed",
    );
  });
});
