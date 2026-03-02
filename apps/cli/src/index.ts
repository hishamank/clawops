#!/usr/bin/env node

import { Command } from "commander";

const program = new Command();

program
  .name("clawops")
  .description("CLI for the ClawOps agent operations platform")
  .version("0.1.0");

program.parse();
