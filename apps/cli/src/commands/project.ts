import { Command } from "commander";
import { api } from "../lib/client.js";

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
    const body: Record<string, string> = { name: opts.name };
    if (opts.status) body["status"] = opts.status;
    const project = await api.post("/projects", body);
    if (opts.json) {
      console.log(JSON.stringify(project, null, 2));
    } else {
      const p = project as Record<string, unknown>;
      console.log(`Created project ${p["id"]}: ${p["name"]}`);
    }
  });

projectCmd
  .command("list")
  .description("List projects")
  .option("--json", "Output raw JSON")
  .action(async (opts) => {
    const projects = await api.get("/projects");
    if (opts.json) {
      console.log(JSON.stringify(projects, null, 2));
    } else {
      const list = projects as Array<Record<string, unknown>>;
      if (list.length === 0) {
        console.log("No projects found.");
      } else {
        for (const p of list) {
          console.log(`[${p["status"]}] ${p["id"]}  ${p["name"]}`);
        }
      }
    }
  });

projectCmd
  .command("info")
  .description("Get project details")
  .argument("<id>", "Project ID")
  .option("--json", "Output raw JSON")
  .action(async (id: string, opts) => {
    const project = await api.get(`/projects/${id}`);
    if (opts.json) {
      console.log(JSON.stringify(project, null, 2));
    } else {
      const p = project as Record<string, unknown>;
      console.log(`Project: ${p["name"]}`);
      console.log(`Status:  ${p["status"]}`);
      console.log(`Tasks:   ${p["taskCount"]}`);
    }
  });
