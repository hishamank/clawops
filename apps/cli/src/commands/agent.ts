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
      const { db, events } = await import("@clawops/core");
      const { initAgent } = await import("@clawops/agents");
      const result = initAgent(db, input);
      data = result.agent;

      // Write agent.registered event
      db.insert(events)
        .values({
          agentId: data.id,
          action: "agent.registered",
          entityType: "agent",
          entityId: data.id,
          meta: JSON.stringify({ name: data.name, created: result.created }),
        })
        .run();
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
  .option("--message <message>", "Status message")
  .action(async (status: string, opts: Record<string, string>) => {
    const id = getAgentId();
    const message = opts["message"] as string | undefined;
    let data: Agent;

    if (isLocalMode()) {
      const { db, events } = await import("@clawops/core");
      const { updateAgentStatus } = await import("@clawops/agents");
      data = updateAgentStatus(db, id, status as AgentStatus, message);

      // Write agent.status_updated event
      db.insert(events)
        .values({
          agentId: id,
          action: "agent.status_updated",
          entityType: "agent",
          entityId: id,
          meta: JSON.stringify({ status, message }),
        })
        .run();
    } else {
      data = (await api.patch(`/agents/${id}/status`, {
        status,
        message,
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
      const { db, events } = await import("@clawops/core");
      const { updateAgentSkills } = await import("@clawops/agents");
      data = updateAgentSkills(db, id, parsed);

      // Write agent.skills_updated event
      db.insert(events)
        .values({
          agentId: id,
          action: "agent.skills_updated",
          entityType: "agent",
          entityId: id,
          meta: JSON.stringify({ skills: parsed }),
        })
        .run();
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

    if (isLocalMode()) {
      const { db, events } = await import("@clawops/core");
      const { logHeartbeat } = await import("@clawops/habits");
      const run = logHeartbeat(db, id);

      // Write agent.heartbeat event
      db.insert(events)
        .values({
          agentId: id,
          action: "agent.heartbeat",
          entityType: "agent",
          entityId: id,
          meta: JSON.stringify({ runId: run.id }),
        })
        .run();

      if (jsonOut(agentCmd)) {
        console.log(JSON.stringify({ id: run.id }, null, 2));
      } else {
        console.log(`agent ${id} heartbeat`);
      }
    } else {
      const data = (await api.post(`/agents/${id}/heartbeat`)) as {
        id: string;
      };

      if (jsonOut(agentCmd)) {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(`agent ${id} heartbeat`);
      }
    }
  });
