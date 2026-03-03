#!/usr/bin/env node

import { Command } from "commander";
import { agentCmd } from "./commands/agent.js";
import { habitCmd } from "./commands/habit.js";
import { taskCmd } from "./commands/task.js";
import { ideaCmd } from "./commands/idea.js";
import { projectCmd } from "./commands/project.js";

const program = new Command();

program
  .name("clawops")
  .description("CLI for the ClawOps agent operations platform")
  .version("0.1.0")
  .option("--json", "Output raw JSON");

program.addCommand(agentCmd);
program.addCommand(habitCmd);
program.addCommand(taskCmd);
program.addCommand(ideaCmd);
program.addCommand(projectCmd);

program.parse();
