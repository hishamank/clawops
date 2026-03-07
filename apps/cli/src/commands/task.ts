import { Command } from "commander";
import { taskCreate, taskList, taskUpdate, taskDone, taskSpec, taskSpecSet, taskSpecSetFile, taskSpecAppend } from "../lib/client.js";
import * as fs from "node:fs";

export const taskCmd = new Command("task").description("Manage tasks");

taskCmd
  .command("create")
  .description("Create a new task")
  .requiredOption("--title <title>", "Task title")
  .option("--desc <description>", "Task description")
  .option("--priority <priority>", "Priority (low, medium, high, critical)")
  .option("--project <id>", "Project ID")
  .option("--assignee <id>", "Assignee agent ID")
  .option("--spec <file>", "Path to spec file")
  .option("--json", "Output raw JSON")
  .action(async (opts) => {
    let specContent: string | undefined;
    if (opts.spec) {
      specContent = fs.readFileSync(opts.spec, "utf-8");
    }
    const task = await taskCreate({
      title: opts.title,
      description: opts.desc,
      priority: opts.priority,
      projectId: opts.project,
      assigneeId: opts.assignee,
      specContent,
    });
    if (opts.json) {
      console.log(JSON.stringify(task, null, 2));
    } else {
      console.log(`Created task ${task.id}: ${task.title}`);
    }
  });

taskCmd
  .command("list")
  .description("List tasks")
  .option("--status <status>", "Filter by status")
  .option("--assignee <id>", "Filter by assignee")
  .option("--project <id>", "Filter by project")
  .option("--with-specs", "Include spec content in output")
  .option("--json", "Output raw JSON")
  .action(async (opts) => {
    const tasks = await taskList({
      status: opts.status,
      assigneeId: opts.assignee,
      projectId: opts.project,
      withSpecs: opts.withSpecs,
    });
    if (opts.json) {
      console.log(JSON.stringify(tasks, null, 2));
    } else if (tasks.length === 0) {
      console.log("No tasks found.");
    } else {
      for (const t of tasks) {
        console.log(`[${t.status}] ${t.id}  ${t.title}`);
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
    const task = await taskUpdate(id, {
      status: opts.status,
      priority: opts.priority,
    });
    if (opts.json) {
      console.log(JSON.stringify(task, null, 2));
    } else {
      console.log(`Updated task ${task.id} → ${task.status}`);
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
    const artifacts = opts.artifacts
      ? (opts.artifacts as string).split(",").map((pair: string) => {
          const [label, ...rest] = pair.split(":");
          return { label, value: rest.join(":") };
        })
      : undefined;
    const task = await taskDone(id, {
      summary: opts.summary,
      tokensIn: opts.tokens ? Number(opts.tokens) : undefined,
      artifacts,
    });
    if (opts.json) {
      console.log(JSON.stringify(task, null, 2));
    } else {
      console.log(`Task ${task.id} marked done.`);
    }
  });

taskCmd
  .command("spec")
  .description("Manage task spec")
  .argument("<id>", "Task ID")
  .option("--set <content>", "Set spec content (markdown string)")
  .option("--file <path>", "Set spec content from file")
  .option("--append <content>", "Append to spec content")
  .option("--json", "Output raw JSON")
  .action(async (id: string, opts) => {
    if (opts.set && opts.file) {
      console.error("Cannot use both --set and --file flags");
      process.exit(1);
    }
    if (opts.set && opts.append) {
      console.error("Cannot use both --set and --append flags");
      process.exit(1);
    }
    if (opts.file && opts.append) {
      console.error("Cannot use both --file and --append flags");
      process.exit(1);
    }

    let result;
    if (opts.set) {
      result = await taskSpecSet(id, opts.set as string);
    } else if (opts.file) {
      result = await taskSpecSetFile(id, opts.file as string);
    } else if (opts.append) {
      result = await taskSpecAppend(id, opts.append as string);
    } else {
      const spec = await taskSpec(id);
      if (opts.json) {
        console.log(JSON.stringify({ spec }, null, 2));
      } else {
        console.log(spec ?? "(no spec)");
      }
      return;
    }

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Task ${id} spec updated.`);
    }
  });
