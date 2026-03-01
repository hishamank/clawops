#!/usr/bin/env node

import { Command } from "commander";
import {
  registerAgent,
  updateAgentStatus,
  startRun,
  finishRun,
  listRuns,
} from "./api.js";

const program = new Command();

program
  .name("clawops")
  .description("ClawOps — agent operations CLI")
  .version("0.1.0");

const agent = program.command("agent").description("Manage agents");

agent
  .command("register")
  .description("Register a new agent")
  .requiredOption("--name <name>", "Agent name")
  .action(async (opts: { name: string }) => {
    try {
      const result = await registerAgent(opts.name);
      console.log(`Agent registered: ${result.id}`);
      console.log(`  Name:   ${result.name}`);
      console.log(`  Status: ${result.status}`);
    } catch (e) {
      console.error(
        `Error: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
      process.exit(1);
    }
  });

agent
  .command("status")
  .description("Update agent status")
  .requiredOption("--id <id>", "Agent ID")
  .requiredOption("--status <status>", "New status (online|offline|error)")
  .action(async (opts: { id: string; status: string }) => {
    try {
      const result = await updateAgentStatus(opts.id, opts.status);
      console.log(`Agent ${result.id} status updated to: ${result.status}`);
    } catch (e) {
      console.error(
        `Error: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
      process.exit(1);
    }
  });

const run = program.command("run").description("Manage runs");

run
  .command("start")
  .description("Start a new run")
  .requiredOption("--agent <id>", "Agent ID")
  .requiredOption("--task <description>", "Task description")
  .action(async (opts: { agent: string; task: string }) => {
    try {
      const result = await startRun(opts.agent, opts.task);
      console.log(`Run started: ${result.id}`);
      console.log(`  Agent: ${result.agentId}`);
      console.log(`  Task:  ${result.task}`);
      console.log(`  Status: ${result.status}`);
    } catch (e) {
      console.error(
        `Error: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
      process.exit(1);
    }
  });

run
  .command("finish")
  .description("Finish a run")
  .requiredOption("--id <run-id>", "Run ID")
  .requiredOption("--output <output>", "Run output")
  .option("--error [error]", "Error message (marks run as failed)")
  .action(async (opts: { id: string; output: string; error?: string }) => {
    try {
      const result = await finishRun(
        opts.id,
        opts.output,
        typeof opts.error === "string" ? opts.error : undefined,
      );
      console.log(`Run ${result.id} finished`);
      console.log(`  Status: ${result.status}`);
      if (result.output) console.log(`  Output: ${result.output}`);
      if (result.error) console.log(`  Error:  ${result.error}`);
    } catch (e) {
      console.error(
        `Error: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
      process.exit(1);
    }
  });

const runs = program.command("runs").description("List runs");

runs
  .command("list")
  .description("List runs")
  .option("--agent <id>", "Filter by agent ID")
  .option("--status <status>", "Filter by status")
  .action(async (opts: { agent?: string; status?: string }) => {
    try {
      const results = await listRuns(opts);
      if (results.length === 0) {
        console.log("No runs found");
        return;
      }
      console.log(`Found ${results.length} run(s):\n`);
      for (const r of results) {
        console.log(`  ${r.id}`);
        console.log(`    Task:    ${r.task}`);
        console.log(`    Status:  ${r.status}`);
        console.log(`    Agent:   ${r.agentId}`);
        console.log(`    Started: ${r.startedAt}`);
        if (r.finishedAt) console.log(`    Finished: ${r.finishedAt}`);
        if (r.output) console.log(`    Output:  ${r.output}`);
        if (r.error) console.log(`    Error:   ${r.error}`);
        console.log();
      }
    } catch (e) {
      console.error(
        `Error: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
      process.exit(1);
    }
  });

program.parse();
