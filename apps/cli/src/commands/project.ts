import { Command } from "commander";
import { projectCreate, projectList, projectInfo } from "../lib/client.js";

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
