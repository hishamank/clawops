/* eslint-disable no-console -- CLI tool uses console for output */

import { Command } from "commander";
import {
  projectCreate,
  projectList,
  projectInfo,
  projectContext,
  projectActivate,
  projectDeactivate,
  getActiveProjectSession,
  projectSpecGet,
  projectSpecSet,
  projectSpecAppend,
} from "../lib/client.js";
import * as fs from "node:fs";

export const projectCmd = new Command("project").description(
  "Manage projects",
);

projectCmd
  .command("create")
  .description("Create a new project")
  .requiredOption("--name <name>", "Project name")
  .option("--status <status>", "Initial status")
  .option("--json", "Output raw JSON")
  .action(async (opts) => {
    const project = await projectCreate({
      name: opts.name,
      status: opts.status,
    });
    if (opts.json) {
      console.log(JSON.stringify(project, null, 2));
    } else {
      console.log(`Created project ${project.id}: ${project.name}`);
    }
  });

projectCmd
  .command("list")
  .description("List projects")
  .option("--json", "Output raw JSON")
  .action(async (opts) => {
    const projects = await projectList();
    if (opts.json) {
      console.log(JSON.stringify(projects, null, 2));
    } else if (projects.length === 0) {
      console.log("No projects found.");
    } else {
      for (const p of projects) {
        console.log(`[${p.status}] ${p.id}  ${p.name}`);
      }
    }
  });

projectCmd
  .command("info")
  .description("Get project details")
  .argument("<id>", "Project ID")
  .option("--json", "Output raw JSON")
  .action(async (id: string, opts) => {
    const project = await projectInfo(id);
    if (opts.json) {
      console.log(JSON.stringify(project, null, 2));
    } else {
      console.log(`Project: ${project.name}`);
      console.log(`Status:  ${project.status}`);
      console.log(`Tasks:   ${project.taskCount}`);
    }
  });

projectCmd
  .command("spec")
  .description("Get or set project spec")
  .argument("<id>", "Project ID")
  .option("--set", "Set/replace full spec content")
  .option("--file <path>", "Read spec from file")
  .option("--append", "Append content to spec")
  .option("--json", "Output raw JSON")
  .action(async (id: string, opts) => {
    if (opts.set) {
      // Read from stdin or --file
      let specContent: string;
      if (opts.file) {
        specContent = fs.readFileSync(opts.file, "utf-8");
      } else {
        // Read from stdin
        specContent = fs.readFileSync(0, "utf-8");
      }
      const project = await projectSpecSet(id, specContent);
      if (opts.json) {
        console.log(JSON.stringify(project, null, 2));
      } else {
        console.log(`Updated spec for project ${project.id}`);
      }
    } else if (opts.append) {
      // Read content from stdin or --file
      let content: string;
      if (opts.file) {
        content = fs.readFileSync(opts.file, "utf-8");
      } else {
        content = fs.readFileSync(0, "utf-8");
      }
      const project = await projectSpecAppend(id, content);
      if (opts.json) {
        console.log(JSON.stringify(project, null, 2));
      } else {
        console.log(`Appended to spec for project ${project.id}`);
      }
    } else {
      // Get spec
      const spec = await projectSpecGet(id);
      if (opts.json) {
        console.log(JSON.stringify({ spec }, null, 2));
      } else if (spec) {
        console.log(spec);
      } else {
        console.log("No spec found for this project.");
      }
    }
  });

projectCmd
  .command("context")
  .description("Get project context snapshot for agents")
  .argument("<id>", "Project ID")
  .option("--minimal", "Return only goal + open tasks (low token cost)")
  .option("--json", "Output raw JSON")
  .action(async (id: string, opts) => {
    const context = await projectContext(id, { minimal: opts.minimal });
    if (opts.json) {
      console.log(JSON.stringify(context, null, 2));
    } else {
      console.log(`Project: ${context.project.name} (${context.project.status})`);
      console.log(`Goal: ${context.project.goal ?? "No goal set"}`);
      console.log(`\nOpen Tasks (${context.openTasks.length}):`);
      for (const task of context.openTasks) {
        console.log(`  [${task.priority}] ${task.title}`);
      }
      if (!opts.minimal) {
        console.log(`\nIn Progress (${context.inProgressTasks.length}):`);
        for (const task of context.inProgressTasks) {
          console.log(`  [${task.priority}] ${task.title}`);
        }
        console.log(`\nBlockers (${context.blockers.length}):`);
        for (const blocker of context.blockers) {
          console.log(`  ${blocker.title}`);
        }
        if (context.lastSessionSummary) {
          console.log(`\nLast Session Summary:\n  ${context.lastSessionSummary}`);
        }
      }
    }
  });

projectCmd
  .command("activate")
  .description("Activate a project for this session")
  .argument("<id>", "Project ID")
  .option("--json", "Output raw JSON")
  .action(async (id: string, opts) => {
    const session = await projectActivate(id);
    if (opts.json) {
      console.log(JSON.stringify(session, null, 2));
    } else {
      console.log(`Activated project ${id} for session ${session.id}`);
    }
  });

projectCmd
  .command("deactivate")
  .description("Deactivate current project and store session summary")
  .requiredOption("--summary <summary>", "Session summary")
  .option("--json", "Output raw JSON")
  .action(async (opts) => {
    const session = await projectDeactivate(opts.summary);
    if (opts.json) {
      console.log(JSON.stringify(session, null, 2));
    } else {
      console.log(`Deactivated session ${session.id}`);
      console.log(`Summary: ${opts.summary}`);
    }
  });

projectCmd
  .command("session")
  .description("Show current active session")
  .option("--json", "Output raw JSON")
  .action(async (opts) => {
    const session = await getActiveProjectSession();
    if (!session) {
      if (opts.json) {
        console.log(JSON.stringify(null));
      } else {
        console.log("No active session");
      }
      return;
    }
    if (opts.json) {
      console.log(JSON.stringify(session, null, 2));
    } else {
      console.log(`Active session: ${session.id}`);
      console.log(`Project: ${session.projectId ?? "None"}`);
      console.log(`Started: ${session.startedAt?.toISOString()}`);
    }
  });
