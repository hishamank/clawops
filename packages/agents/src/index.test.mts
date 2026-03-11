import assert from "node:assert";
import { describe, it } from "node:test";
import { agents, openclawAgents } from "@clawops/core";
import { initAgent } from "./index.js";

type AgentRow = {
  id: string;
  name: string;
  model: string;
  role: string;
  framework: string;
  memoryPath: string | null;
  skills: string | null;
  avatar: string | null;
};

type OpenClawMappingRow = {
  linkedAgentId: string;
  connectionId: string;
  externalAgentId: string;
  externalAgentName: string;
  workspacePath: string | null;
  memoryPath: string | null;
  defaultModel: string | null;
  role: string | null;
  avatar: string | null;
};

function createMockDb(initial?: {
  agent?: AgentRow | null;
  joinedAgent?: AgentRow | null;
}) {
  let agent = initial?.agent ?? null;
  let joinedAgent = initial?.joinedAgent ?? agent;
  let mapping: OpenClawMappingRow | null = null;
  let insertedAgentValues: Record<string, unknown> | null = null;
  let updatedAgentValues: Record<string, unknown> | null = null;
  let selectTarget: unknown;

  const selectChain = {
    from(target: unknown) {
      selectTarget = target;
      return selectChain;
    },
    innerJoin() {
      return selectChain;
    },
    where() {
      return selectChain;
    },
    limit() {
      return selectChain;
    },
    get() {
      if (selectTarget === openclawAgents) {
        return mapping;
      }
      return agent;
    },
    all() {
      if (selectTarget === openclawAgents) {
        return joinedAgent ? [{ agent: joinedAgent }] : [];
      }
      return agent ? [agent] : [];
    },
  };

  const insertChain = {
    values(values: Record<string, unknown>) {
      insertedAgentValues = values;
      return insertChain;
    },
    onConflictDoUpdate(config: { set: Record<string, unknown> }) {
      mapping = {
        linkedAgentId: config.set["linkedAgentId"] as string,
        connectionId: insertedAgentValues?.["connectionId"] as string,
        externalAgentId: insertedAgentValues?.["externalAgentId"] as string,
        externalAgentName: config.set["externalAgentName"] as string,
        workspacePath: config.set["workspacePath"] as string | null,
        memoryPath: config.set["memoryPath"] as string | null,
        defaultModel: config.set["defaultModel"] as string | null,
        role: config.set["role"] as string | null,
        avatar: config.set["avatar"] as string | null,
      };
      return insertChain;
    },
    returning() {
      return insertChain;
    },
    all() {
      if (selectTarget === openclawAgents) {
        return [mapping];
      }

      agent = {
        id: "agent-created",
        name: insertedAgentValues?.["name"] as string,
        model: insertedAgentValues?.["model"] as string,
        role: insertedAgentValues?.["role"] as string,
        framework: insertedAgentValues?.["framework"] as string,
        memoryPath: insertedAgentValues?.["memoryPath"] as string | null,
        skills: insertedAgentValues?.["skills"] as string | null,
        avatar: insertedAgentValues?.["avatar"] as string | null,
      };
      joinedAgent = agent;
      return [agent];
    },
    run() {
      return undefined;
    },
  };

  const updateChain = {
    set(values: Record<string, unknown>) {
      updatedAgentValues = values;
      return updateChain;
    },
    where() {
      return updateChain;
    },
    returning() {
      return updateChain;
    },
    all() {
      if (!agent) {
        return [];
      }
      agent = {
        ...agent,
        name: (updatedAgentValues?.["name"] as string) ?? agent.name,
        model: (updatedAgentValues?.["model"] as string) ?? agent.model,
        role: (updatedAgentValues?.["role"] as string) ?? agent.role,
        framework: (updatedAgentValues?.["framework"] as string) ?? agent.framework,
        memoryPath: (updatedAgentValues?.["memoryPath"] as string | null) ?? agent.memoryPath,
        skills: (updatedAgentValues?.["skills"] as string | null) ?? agent.skills,
        avatar: (updatedAgentValues?.["avatar"] as string | null) ?? agent.avatar,
      };
      joinedAgent = agent;
      return [agent];
    },
  };

  return {
    db: {
      select() {
        return selectChain;
      },
      insert(target: unknown) {
        selectTarget = target;
        return insertChain;
      },
      update() {
        return updateChain;
      },
    },
    getState() {
      return { agent, mapping };
    },
  };
}

describe("initAgent", () => {
  it("creates a durable OpenClaw mapping for new agents", () => {
    const mock = createMockDb();

    const result = initAgent(mock.db as never, {
      name: "Scout",
      model: "gpt-5",
      role: "researcher",
      framework: "openclaw",
      memoryPath: "/tmp/openclaw/workspace-main",
      openclaw: {
        connectionId: "conn-1",
        externalAgentId: "main",
        externalAgentName: "Scout",
        workspacePath: "/tmp/openclaw/workspace-main",
      },
    });

    const state = mock.getState();

    assert.equal(result.created, true);
    assert.equal(state.agent?.id, "agent-created");
    assert.equal(state.mapping?.linkedAgentId, "agent-created");
    assert.equal(state.mapping?.externalAgentId, "main");
  });

  it("reuses the same agent when the durable OpenClaw identity already exists", () => {
    const existingAgent: AgentRow = {
      id: "agent-1",
      name: "Scout",
      model: "gpt-5",
      role: "researcher",
      framework: "openclaw",
      memoryPath: "/tmp/openclaw/workspace-main",
      skills: null,
      avatar: null,
    };
    const mock = createMockDb({
      agent: existingAgent,
      joinedAgent: existingAgent,
    });

    initAgent(mock.db as never, {
      name: "Scout",
      model: "gpt-5",
      role: "researcher",
      framework: "openclaw",
      memoryPath: "/tmp/openclaw/workspace-main",
      openclaw: {
        connectionId: "conn-1",
        externalAgentId: "main",
        externalAgentName: "Scout",
        workspacePath: "/tmp/openclaw/workspace-main",
      },
    });

    const result = initAgent(mock.db as never, {
      name: "Scout Prime",
      model: "gpt-5-mini",
      role: "orchestrator",
      framework: "openclaw",
      memoryPath: "/tmp/openclaw/workspace-main",
      openclaw: {
        connectionId: "conn-1",
        externalAgentId: "main",
        externalAgentName: "Scout Prime",
        workspacePath: "/tmp/openclaw/workspace-main",
      },
    });

    const state = mock.getState();

    assert.equal(result.created, false);
    assert.equal(result.agent.id, "agent-1");
    assert.equal(state.agent?.name, "Scout Prime");
    assert.equal(state.mapping?.externalAgentName, "Scout Prime");
  });
});
