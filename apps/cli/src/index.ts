#!/usr/bin/env node

import { Command } from "commander";
import { agentCmd } from "./commands/agent.js";
import { cronCmd } from "./commands/cron.js";
import { habitCmd } from "./commands/habit.js";
import { taskCmd } from "./commands/task.js";
import { ideaCmd } from "./commands/idea.js";
import { projectCmd } from "./commands/project.js";
import { onboardCmd } from "./commands/onboard.js";
import { syncCmd } from "./commands/sync.js";
import { webCmd } from "./commands/web.js";
import { ensureMigrated } from "./lib/client.js";

const program = new Command();

program
  .name("clawops")
  .description("CLI for the ClawOps agent operations platform")
  .version("0.1.0")
  .option("--json", "Output raw JSON");

program.addCommand(agentCmd);
program.addCommand(cronCmd);
program.addCommand(habitCmd);
program.addCommand(taskCmd);
program.addCommand(ideaCmd);
program.addCommand(projectCmd);
program.addCommand(onboardCmd);
program.addCommand(syncCmd);
program.addCommand(webCmd);

program.hook("preAction", () => {
  try {
    ensureMigrated();
  } catch (err) {
    console.error("Failed to run migrations:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
});

program.parse();
