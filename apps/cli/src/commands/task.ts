import { Command } from "commander";
import { api } from "../lib/client.js";

export const taskCmd = new Command("task").description("Manage tasks");

taskCmd
  .command("create")
  .description("Create a new task")
  .requiredOption("--title <title>", "Task title")
  .option("--desc <description>", "Task description")
  .option("--priority <priority>", "Priority (low, medium, high, critical)")
  .option("--project <id>", "Project ID")
  .option("--assignee <id>", "Assignee agent ID")
  .option("--json", "Output raw JSON")
  .action(async (opts) => {
    const task = await api.post("/tasks", {
      title: opts.title,
      description: opts.desc,
      priority: opts.priority,
      projectId: opts.project,
      assigneeId: opts.assignee,
    });
    if (opts.json) {
      console.log(JSON.stringify(task, null, 2));
    } else {
      const t = task as Record<string, unknown>;
      console.log(`Created task ${t["id"]}: ${t["title"]}`);
    }
  });

taskCmd
  .command("list")
  .description("List tasks")
  .option("--status <status>", "Filter by status")
  .option("--assignee <id>", "Filter by assignee")
  .option("--project <id>", "Filter by project")
  .option("--json", "Output raw JSON")
  .action(async (opts) => {
    const params = new URLSearchParams();
    if (opts.status) params.set("status", opts.status);
    if (opts.assignee) params.set("assigneeId", opts.assignee);
    if (opts.project) params.set("projectId", opts.project);
    const qs = params.toString();
    const tasks = await api.get(`/tasks${qs ? `?${qs}` : ""}`);
    if (opts.json) {
      console.log(JSON.stringify(tasks, null, 2));
    } else {
      const list = tasks as Array<Record<string, unknown>>;
      if (list.length === 0) {
        console.log("No tasks found.");
      } else {
        for (const t of list) {
          console.log(`[${t["status"]}] ${t["id"]}  ${t["title"]}`);
        }
      }
    }
  });

taskCmd
  .command("update")
  .description("Update a task")
  .argument("<id>", "Task ID")
  .requiredOption("--status <status>", "New status")
  .option("--priority <priority>", "New priority")
  .option("--json", "Output raw JSON")
  .action(async (id: string, opts) => {
    const body: Record<string, string> = { status: opts.status };
    if (opts.priority) body["priority"] = opts.priority;
    const task = await api.patch(`/tasks/${id}`, body);
    if (opts.json) {
      console.log(JSON.stringify(task, null, 2));
    } else {
      const t = task as Record<string, unknown>;
      console.log(`Updated task ${t["id"]} → ${t["status"]}`);
    }
  });

taskCmd
  .command("done")
  .description("Mark a task as done")
  .argument("<id>", "Task ID")
  .requiredOption("--summary <summary>", "Completion summary")
  .option("--tokens <n>", "Token count")
  .option("--artifacts <artifacts>", "Artifacts as label:value,...")
  .option("--json", "Output raw JSON")
  .action(async (id: string, opts) => {
    const body: Record<string, unknown> = { summary: opts.summary };
    if (opts.tokens) body["tokensIn"] = Number(opts.tokens);
    if (opts.artifacts) {
      body["artifacts"] = (opts.artifacts as string)
        .split(",")
        .map((pair: string) => {
          const [label, ...rest] = pair.split(":");
          return { label, value: rest.join(":") };
        });
    }
    const task = await api.post(`/tasks/${id}/complete`, body);
    if (opts.json) {
      console.log(JSON.stringify(task, null, 2));
    } else {
      const t = task as Record<string, unknown>;
      console.log(`Task ${t["id"]} marked done.`);
    }
  });
