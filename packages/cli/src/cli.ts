#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import {
  registerAgent,
  updateAgentStatus,
  startRun,
  finishRun,
  listRuns,
} from "./api.js";
import { loadConfig, saveConfig } from "./config.js";

function statusColor(status: string): string {
  switch (status) {
    case "online":
    case "completed":
      return chalk.green(status);
    case "running":
      return chalk.blue(status);
    case "pending":
      return chalk.yellow(status);
    case "failed":
    case "error":
      return chalk.red(status);
    case "offline":
      return chalk.gray(status);
    default:
      return status;
  }
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len - 1) + "…";
}

function formatDuration(startedAt: string, finishedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const ms = end - start;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function handleError(e: unknown, json: boolean): never {
  const message = e instanceof Error ? e.message : "Unknown error";
  if (json) {
    console.log(JSON.stringify({ error: message }));
  } else {
    console.error(chalk.red(`Error: ${message}`));
  }
  process.exit(1);
}

const program = new Command();

program
  .name("clawops")
  .description("ClawOps — agent operations CLI")
  .version("0.1.0");

// ── agent commands ──────────────────────────────────────────────

const agent = program.command("agent").description("Manage agents");

agent
  .command("register")
  .description("Register a new agent")
  .requiredOption("--name <name>", "Agent name")
  .option("--json", "Output as JSON")
  .action(async (opts: { name: string; json?: boolean }) => {
    try {
      const result = await registerAgent(opts.name);
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(chalk.green("✓") + " Agent registered successfully");
      console.log(`  ${chalk.bold("ID:")}     ${result.id}`);
      console.log(`  ${chalk.bold("Name:")}   ${result.name}`);
      console.log(`  ${chalk.bold("Status:")} ${statusColor(result.status)}`);
    } catch (e) {
      handleError(e, !!opts.json);
    }
  });

agent
  .command("status")
  .description("Update agent status")
  .requiredOption("--id <id>", "Agent ID")
  .requiredOption("--status <status>", "New status (online|offline|error)")
  .option("--json", "Output as JSON")
  .action(async (opts: { id: string; status: string; json?: boolean }) => {
    try {
      const result = await updateAgentStatus(opts.id, opts.status);
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(
        chalk.green("✓") +
          ` Agent ${chalk.bold(result.id.slice(0, 8))} status → ${statusColor(result.status)}`,
      );
    } catch (e) {
      handleError(e, !!opts.json);
    }
  });

// ── run commands ────────────────────────────────────────────────

const run = program.command("run").description("Manage runs");

run
  .command("start")
  .description("Start a new run")
  .requiredOption("--agent <id>", "Agent ID")
  .requiredOption("--task <description>", "Task description")
  .option("--json", "Output as JSON")
  .action(
    async (opts: { agent: string; task: string; json?: boolean }) => {
      try {
        const result = await startRun(opts.agent, opts.task);
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        console.log(chalk.green("✓") + " Run started");
        console.log(`  ${chalk.bold("Run ID:")} ${result.id}`);
        console.log(`  ${chalk.bold("Agent:")}  ${result.agentId}`);
        console.log(`  ${chalk.bold("Task:")}   ${result.task}`);
        console.log(`  ${chalk.bold("Status:")} ${statusColor(result.status)}`);
      } catch (e) {
        handleError(e, !!opts.json);
      }
    },
  );

run
  .command("finish")
  .description("Finish a run")
  .requiredOption("--id <run-id>", "Run ID")
  .requiredOption("--output <output>", "Run output")
  .option("--error [error]", "Error message (marks run as failed)")
  .option("--json", "Output as JSON")
  .action(
    async (opts: {
      id: string;
      output: string;
      error?: string;
      json?: boolean;
    }) => {
      try {
        const result = await finishRun(
          opts.id,
          opts.output,
          typeof opts.error === "string" ? opts.error : undefined,
        );
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        console.log(
          chalk.green("✓") +
            ` Run ${chalk.bold(result.id.slice(0, 8))} finished — ${statusColor(result.status)}`,
        );
        if (result.output)
          console.log(`  ${chalk.bold("Output:")} ${result.output}`);
        if (result.error)
          console.log(`  ${chalk.bold("Error:")}  ${chalk.red(result.error)}`);
      } catch (e) {
        handleError(e, !!opts.json);
      }
    },
  );

// ── runs list ───────────────────────────────────────────────────

const runs = program.command("runs").description("List runs");

runs
  .command("list")
  .description("List runs")
  .option("--agent <id>", "Filter by agent ID")
  .option("--status <status>", "Filter by status")
  .option("--json", "Output as JSON")
  .action(
    async (opts: { agent?: string; status?: string; json?: boolean }) => {
      try {
        const results = await listRuns(opts);
        if (opts.json) {
          console.log(JSON.stringify(results, null, 2));
          return;
        }
        if (results.length === 0) {
          console.log(chalk.yellow("No runs found"));
          return;
        }
        console.log(
          chalk.bold(`Found ${results.length} run(s)`) + "\n",
        );
        const table = new Table({
          head: ["ID", "Agent", "Task", "Status", "Started", "Duration"],
          style: { head: ["cyan"] },
        });
        for (const r of results) {
          table.push([
            r.id.slice(0, 8),
            r.agentId.slice(0, 8),
            truncate(r.task, 40),
            statusColor(r.status),
            formatTime(r.startedAt),
            formatDuration(r.startedAt, r.finishedAt),
          ]);
        }
        console.log(table.toString());
      } catch (e) {
        handleError(e, !!opts.json);
      }
    },
  );

// ── config commands ─────────────────────────────────────────────

const config = program.command("config").description("Manage configuration");

config
  .command("set")
  .description("Set a configuration value")
  .requiredOption("--api-url <url>", "API server URL")
  .option("--json", "Output as JSON")
  .action(async (opts: { apiUrl: string; json?: boolean }) => {
    try {
      const cfg = loadConfig();
      cfg.apiUrl = opts.apiUrl;
      saveConfig(cfg);
      if (opts.json) {
        console.log(JSON.stringify(cfg, null, 2));
        return;
      }
      console.log(chalk.green("✓") + " Configuration saved");
      console.log(`  ${chalk.bold("API URL:")} ${cfg.apiUrl}`);
    } catch (e) {
      handleError(e, !!opts.json);
    }
  });

config
  .command("get")
  .description("Show current configuration")
  .option("--json", "Output as JSON")
  .action(async (opts: { json?: boolean }) => {
    try {
      const cfg = loadConfig();
      const apiUrl =
        process.env.CLAWOPS_API_URL ?? cfg.apiUrl ?? "http://localhost:3001";
      if (opts.json) {
        console.log(
          JSON.stringify(
            {
              apiUrl,
              source: process.env.CLAWOPS_API_URL
                ? "env"
                : cfg.apiUrl
                  ? "config"
                  : "default",
            },
            null,
            2,
          ),
        );
        return;
      }
      console.log(chalk.bold("ClawOps Configuration\n"));
      console.log(`  ${chalk.bold("API URL:")} ${apiUrl}`);
      if (process.env.CLAWOPS_API_URL) {
        console.log(`  ${chalk.gray("(from CLAWOPS_API_URL env var)")}`);
      } else if (cfg.apiUrl) {
        console.log(`  ${chalk.gray("(from ~/.clawops/config.json)")}`);
      } else {
        console.log(`  ${chalk.gray("(default)")}`);
      }
    } catch (e) {
      handleError(e, !!opts.json);
    }
  });

program.parse();
