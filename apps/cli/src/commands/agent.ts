/* eslint-disable no-console -- CLI tool uses console for output */

import { Command } from "commander";
import { api, getAgentId, isLocalMode } from "../lib/client.js";
import type { Agent } from "@clawops/core";
import type { AgentStatus } from "@clawops/domain";

export const agentCmd = new Command("agent").description(
  "Manage agents",
);

// ── helpers ────────────────────────────────────────────────────────────────

function jsonOut(cmd: Command): boolean {
  return Boolean(cmd.parent?.opts()["json"]);
}

// ── agent init ──────────────────────────────────────────────────────────────

agentCmd
  .command("init")
  .description("Register a new agent")
  .requiredOption("--name <name>", "Agent name")
  .requiredOption("--model <model>", "Model identifier")
  .requiredOption("--role <role>", "Agent role")
  .requiredOption("--framework <framework>", "Agent framework")
  .option("--skills <skills>", "Comma-separated skills")
  .action(async (opts: Record<string, string>) => {
    const skills = opts["skills"]
      ? opts["skills"].split(",").map((s) => s.trim())
      : undefined;
    const input = {
      name: opts["name"] as string,
      model: opts["model"] as string,
      role: opts["role"] as string,
      framework: opts["framework"] as string,
      skills,
    };

    let data: Agent;

    if (isLocalMode()) {
      const { db } = await import("@clawops/core");
      const { initAgent } = await import("@clawops/agents");
      const result = initAgent(db, input);
      data = result.agent;
    } else {
      data = (await api.post("/agents/register", input)) as Agent;
    }

    if (jsonOut(agentCmd)) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`agent ${data.id} created`);
    }
  });

// ── agent status ────────────────────────────────────────────────────────────

const statusCmd = agentCmd.command("status").description("Manage agent status");

statusCmd
  .command("set <status>")
  .description("Set agent status (online|idle|busy|offline)")
  .action(async (status: string) => {
    const id = getAgentId();
    let data: Agent;

    if (isLocalMode()) {
      const { db } = await import("@clawops/core");
      const { updateAgentStatus } = await import("@clawops/agents");
      data = updateAgentStatus(db, id, status as AgentStatus);
    } else {
      data = (await api.patch(`/agents/${id}/status`, {
        status,
      })) as Agent;
    }

    if (jsonOut(agentCmd)) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`agent ${data.id} status ${status}`);
    }
  });

// ── agent skills ────────────────────────────────────────────────────────────

const skillsCmd = agentCmd.command("skills").description("Manage agent skills");

skillsCmd
  .command("set <skills>")
  .description("Update agent skills (comma-separated)")
  .action(async (skills: string) => {
    const id = getAgentId();
    const parsed = skills.split(",").map((s) => s.trim());
    let data: Agent;

    if (isLocalMode()) {
      const { db } = await import("@clawops/core");
      const { updateAgentSkills } = await import("@clawops/agents");
      data = updateAgentSkills(db, id, parsed);
    } else {
      data = (await api.patch(`/agents/${id}/skills`, {
        skills: parsed,
      })) as Agent;
    }

    if (jsonOut(agentCmd)) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`agent ${data.id} skills updated`);
    }
  });

// ── agent heartbeat ─────────────────────────────────────────────────────────

agentCmd
  .command("heartbeat")
  .description("Send agent heartbeat")
  .action(async () => {
    const id = getAgentId();
    let data: { id: string };

    if (isLocalMode()) {
      const { db } = await import("@clawops/core");
      const { logHeartbeat } = await import("@clawops/habits");
      const run = logHeartbeat(db, id);
      data = { id: run.id };
    } else {
      data = (await api.post(`/agents/${id}/heartbeat`)) as { id: string };
    }

    if (jsonOut(agentCmd)) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`agent ${data.id} heartbeat`);
    }
  });
