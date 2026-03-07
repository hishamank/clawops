/* eslint-disable no-console -- CLI tool uses console for output */

import { Command } from "commander";
import { getAgentId } from "../lib/client.js";
import type { Agent } from "@clawops/core";
import type { AgentStatus } from "@clawops/domain";

export const agentCmd = new Command("agent").description("Manage agents");

function jsonOut(cmd: Command): boolean {
  return Boolean(cmd.parent?.opts()["json"]);
}

agentCmd
  .command("init")
  .description("Register a new agent")
  .requiredOption("--name <name>", "Agent name")
  .requiredOption("--model <model>", "Model identifier")
  .requiredOption("--role <role>", "Agent role")
  .requiredOption("--framework <framework>", "Agent framework")
  .option("--skills <skills>", "Comma-separated skills")
  .action(async (opts: Record<string, string>) => {
    const skills = opts["skills"] ? opts["skills"].split(",").map((s) => s.trim()) : undefined;
    const input = {
      name: opts["name"] as string,
      model: opts["model"] as string,
      role: opts["role"] as string,
      framework: opts["framework"] as string,
      skills,
    };

    const { events } = await import("@clawops/core");
    const { db } = await import("@clawops/core/db");
    const { initAgent } = await import("@clawops/agents");
    const result = initAgent(db, input);
    const data = result.agent;

    db.insert(events)
      .values({
        agentId: data.id,
        action: "agent.registered",
        entityType: "agent",
        entityId: data.id,
        meta: JSON.stringify({ name: data.name, created: result.created }),
      })
      .run();

    if (jsonOut(agentCmd)) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`agent ${data.id} created`);
    }
  });

const statusCmd = agentCmd.command("status").description("Manage agent status");

statusCmd
  .command("set <status>")
  .description("Set agent status (online|idle|busy|offline)")
  .option("--message <message>", "Status message")
  .action(async (status: string, opts: Record<string, string>) => {
    const id = getAgentId();
    const message = opts["message"] as string | undefined;

    const { events } = await import("@clawops/core");
    const { db } = await import("@clawops/core/db");
    const { updateAgentStatus } = await import("@clawops/agents");
    const data = updateAgentStatus(db, id, status as AgentStatus, message);

    db.insert(events)
      .values({
        agentId: id,
        action: "agent.status_updated",
        entityType: "agent",
        entityId: id,
        meta: JSON.stringify({ status, message }),
      })
      .run();

    if (jsonOut(agentCmd)) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`agent ${data.id} status ${status}`);
    }
  });

const skillsCmd = agentCmd.command("skills").description("Manage agent skills");

skillsCmd
  .command("set <skills>")
  .description("Update agent skills (comma-separated)")
  .action(async (skills: string) => {
    const id = getAgentId();
    const parsed = skills.split(",").map((s) => s.trim());

    const { events } = await import("@clawops/core");
    const { db } = await import("@clawops/core/db");
    const { updateAgentSkills } = await import("@clawops/agents");
    const data: Agent = updateAgentSkills(db, id, parsed);

    db.insert(events)
      .values({
        agentId: id,
        action: "agent.skills_updated",
        entityType: "agent",
        entityId: id,
        meta: JSON.stringify({ skills: parsed }),
      })
      .run();

    if (jsonOut(agentCmd)) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`agent ${data.id} skills updated`);
    }
  });

agentCmd
  .command("heartbeat")
  .description("Send agent heartbeat")
  .action(async () => {
    const id = getAgentId();

    const { events } = await import("@clawops/core");
    const { db } = await import("@clawops/core/db");
    const { logHeartbeat } = await import("@clawops/habits");
    const run = logHeartbeat(db, id);

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
  });
