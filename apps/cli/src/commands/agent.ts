/* eslint-disable no-console -- CLI tool uses console for output */

import { Command } from "commander";
import { api, getAgentId } from "../lib/client.js";

interface AgentResult {
  id: string;
  [key: string]: unknown;
}

export const agentCmd = new Command("agent").description(
  "Manage agents",
);

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
    const body: Record<string, unknown> = {
      name: opts["name"],
      model: opts["model"],
      role: opts["role"],
      framework: opts["framework"],
    };
    if (opts["skills"]) {
      body["skills"] = opts["skills"].split(",").map((s) => s.trim());
    }
    const data = (await api.post("/agents/register", body)) as AgentResult;
    if (agentCmd.parent?.opts()["json"]) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`agent ${data["id"]} created`);
    }
  });

// ── agent status ────────────────────────────────────────────────────────────

agentCmd
  .command("status <status>")
  .description("Set agent status (online|idle|busy|offline)")
  .action(async (status: string) => {
    const id = getAgentId();
    const data = (await api.patch(`/agents/${id}/status`, {
      status,
    })) as AgentResult;
    if (agentCmd.parent?.opts()["json"]) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`agent ${data["id"]} status ${status}`);
    }
  });

// ── agent skills ────────────────────────────────────────────────────────────

agentCmd
  .command("skills <skills>")
  .description("Update agent skills (comma-separated)")
  .action(async (skills: string) => {
    const id = getAgentId();
    const parsed = skills.split(",").map((s) => s.trim());
    const data = (await api.patch(`/agents/${id}/skills`, {
      skills: parsed,
    })) as AgentResult;
    if (agentCmd.parent?.opts()["json"]) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`agent ${data["id"]} skills updated`);
    }
  });

// ── agent heartbeat ─────────────────────────────────────────────────────────

agentCmd
  .command("heartbeat")
  .description("Send agent heartbeat")
  .action(async () => {
    const id = getAgentId();
    const data = (await api.post(
      `/agents/${id}/heartbeat`,
    )) as AgentResult;
    if (agentCmd.parent?.opts()["json"]) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`agent ${data["id"]} heartbeat`);
    }
  });
