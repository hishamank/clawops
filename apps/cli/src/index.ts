#!/usr/bin/env node

import { Command } from "commander";
import { taskCmd } from "./commands/task.js";
import { ideaCmd } from "./commands/idea.js";
import { projectCmd } from "./commands/project.js";

const program = new Command();

program
  .name("clawops")
  .description("CLI for the ClawOps agent operations platform")
  .version("0.1.0");

program.addCommand(taskCmd);
program.addCommand(ideaCmd);
program.addCommand(projectCmd);

program.parse();
