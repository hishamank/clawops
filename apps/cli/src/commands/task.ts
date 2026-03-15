/* eslint-disable no-console -- CLI tool uses console for output */

import { Command } from "commander";
import {
  taskLinkAdd,
  taskLinkList,
  taskLinkRemove,
  taskCreate,
  taskList,
  taskPullable,
  taskUpdate,
  taskDone,
  taskSpec,
  taskSpecSet,
  taskSpecSetFile,
  taskSpecAppend,
  taskRelationsList,
  taskRelationCreate,
  taskRelationDelete,
} from "../lib/client.js";
import * as fs from "node:fs";

const currentAgentId = process.env["CLAWOPS_AGENT_ID"] ?? null;

async function logTaskCommandEvent(params: {
  action: string;
  entityType: string;
  entityId: string;
  meta?: Record<string, unknown> | null;
}) {
  const { events } = await import("@clawops/core");
  const { db } = await import("@clawops/core/db");
  db.insert(events)
    .values({
      agentId: currentAgentId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      meta: params.meta ? JSON.stringify(params.meta) : null,
    })
    .run();
}

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
  .option("--template-id <id>", "Task template ID")
  .option("--stage-id <id>", "Task template stage ID")
  .option("--properties <json>", "Task properties as JSON string")
  .option("--idea-id <id>", "Linked idea ID")
  .option("--json", "Output raw JSON")
  .action(async (opts) => {
    let specContent: string | undefined;
    if (opts.spec) {
      specContent = fs.readFileSync(opts.spec, "utf-8");
    }
    let properties: Record<string, unknown> | undefined;
    if (opts.properties) {
      try {
        const rawProps = JSON.parse(opts.properties) as unknown;
        if (rawProps === null || typeof rawProps !== "object" || Array.isArray(rawProps)) {
          console.error("--properties must be a JSON object (e.g., '{\"key\": \"value\"}')");
          process.exit(1);
        }
        properties = rawProps as Record<string, unknown>;
      } catch {
        console.error("Invalid JSON for --properties");
        process.exit(1);
      }
    }
    const task = await taskCreate({
      title: opts.title,
      description: opts.desc,
      priority: opts.priority,
      projectId: opts.project,
      assigneeId: opts.assignee,
      specContent,
      templateId: opts.templateId,
      stageId: opts.stageId,
      properties,
      ideaId: opts.ideaId,
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
  .command("pullable")
  .description("List tasks eligible for autonomous pickup by an agent")
  .option("--project <id>", "Filter by project")
  .option("--priority <priority>", "Filter by priority (low, medium, high, urgent)")
  .option("--template <id>", "Filter by template ID")
  .option("--stage <id>", "Filter by stage ID")
  .option("--json", "Output raw JSON")
  .action(async (opts) => {
    const tasks = await taskPullable({
      projectId: opts.project,
      priority: opts.priority,
      templateId: opts.template,
      stageId: opts.stage,
    });
    if (opts.json) {
      console.log(JSON.stringify(tasks, null, 2));
    } else if (tasks.length === 0) {
      console.log("No pullable tasks found.");
    } else {
      console.log(`Found ${tasks.length} pullable task(s):`);
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
  .option("--template-id <id>", "Task template ID")
  .option("--stage-id <id>", "Task template stage ID")
  .option("--properties <json>", "Task properties as JSON string")
  .option("--idea-id <id>", "Linked idea ID")
  .option("--json", "Output raw JSON")
  .action(async (id: string, opts) => {
    let properties: Record<string, unknown> | null | undefined;
    if (opts.properties !== undefined) {
      if (opts.properties === "null") {
        properties = null;
      } else {
        try {
          const rawProps = JSON.parse(opts.properties) as unknown;
          if (rawProps === null || typeof rawProps !== "object" || Array.isArray(rawProps)) {
            console.error("--properties must be a JSON object (e.g., '{\"key\": \"value\"}')");
            process.exit(1);
          }
          properties = rawProps as Record<string, unknown>;
        } catch {
          console.error("Invalid JSON for --properties");
          process.exit(1);
        }
      }
    }
    const task = await taskUpdate(id, {
      status: opts.status,
      priority: opts.priority,
      templateId: opts.templateId,
      stageId: opts.stageId,
      properties,
      ideaId: opts.ideaId,
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

const linkCmd = taskCmd
  .command("link")
  .description("Manage task resource links");

linkCmd
  .command("add")
  .description("Attach a resource link to a task")
  .argument("<taskId>", "Task ID")
  .requiredOption("--provider <provider>", "Link provider")
  .requiredOption("--resource-type <type>", "Resource type")
  .requiredOption("--url <url>", "Resource URL")
  .option("--label <label>", "Display label")
  .option("--external-id <id>", "Provider resource identifier")
  .option("--meta <json>", "Metadata as JSON object")
  .option("--json", "Output raw JSON")
  .action(async (taskId: string, opts) => {
    let meta: Record<string, unknown> | undefined;
    if (opts.meta) {
      try {
        const parsed = JSON.parse(opts.meta);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          console.error("--meta must be a JSON object");
          process.exit(1);
        }
        meta = parsed;
      } catch {
        console.error("Invalid JSON for --meta");
        process.exit(1);
      }
    }

    const link = await taskLinkAdd(taskId, {
      provider: opts.provider,
      resourceType: opts.resourceType,
      url: opts.url,
      label: opts.label,
      externalId: opts.externalId,
      meta,
    });
    await logTaskCommandEvent({
      action: "task.resource_link.added",
      entityType: "task",
      entityId: taskId,
      meta: { provider: opts.provider, resourceType: opts.resourceType, linkId: link.id },
    });
    if (opts.json) {
      console.log(JSON.stringify(link, null, 2));
    } else {
      console.log(`link ${link.id} added`);
    }
  });

linkCmd
  .command("list")
  .description("List resource links attached to a task")
  .argument("<taskId>", "Task ID")
  .option("--json", "Output raw JSON")
  .action(async (taskId: string, opts) => {
    const links = await taskLinkList(taskId);
    await logTaskCommandEvent({
      action: "task.resource_link.listed",
      entityType: "task",
      entityId: taskId,
      meta: { count: links.length },
    });
    if (opts.json) {
      console.log(JSON.stringify(links, null, 2));
      return;
    }
    if (links.length === 0) {
      console.log("No links found.");
      return;
    }
    for (const link of links) {
      console.log(`${link.id} ${link.provider}/${link.resourceType} ${link.url}`);
    }
  });

linkCmd
  .command("remove")
  .description("Remove a resource link from a task")
  .argument("<taskId>", "Task ID")
  .argument("<linkId>", "Link ID")
  .option("--json", "Output raw JSON")
  .action(async (taskId: string, linkId: string, opts) => {
    const removed = await taskLinkRemove(taskId, linkId);
    if (!removed) {
      console.error("Resource link not found.");
      process.exit(1);
    }
    await logTaskCommandEvent({
      action: "task.resource_link.removed",
      entityType: "task",
      entityId: taskId,
      meta: { linkId: removed.id },
    });
    if (opts.json) {
      console.log(JSON.stringify(removed, null, 2));
    } else {
      console.log(`link ${removed.id} removed`);
    }
  });

taskCmd
  .command("relations")
  .description("List all relations for a task")
  .argument("<id>", "Task ID")
  .option("--json", "Output raw JSON")
  .action(async (id: string, opts) => {
    const relations = await taskRelationsList(id);
    await logTaskCommandEvent({
      action: "task.relation.listed",
      entityType: "task",
      entityId: id,
      meta: { count: relations.length },
    });
    if (opts.json) {
      console.log(JSON.stringify(relations, null, 2));
    } else if (relations.length === 0) {
      console.log("No relations found.");
    } else {
      for (const r of relations) {
        console.log(
          `[${r.relation.type}] ${r.direction}  ${r.relation.id}  ${r.task.id}  ${r.task.title}`,
        );
      }
    }
  });

taskCmd
  .command("block")
  .description("Declare that a task blocks another task")
  .argument("<id>", "Task ID (the blocker)")
  .argument("<targetId>", "Task ID to be blocked")
  .option("--json", "Output raw JSON")
  .action(async (id: string, targetId: string, opts) => {
    const relation = await taskRelationCreate(id, {
      fromTaskId: id,
      toTaskId: targetId,
      type: "blocks",
    });
    await logTaskCommandEvent({
      action: "task.relation.created",
      entityType: "task_relation",
      entityId: relation.id,
      meta: { fromTaskId: id, toTaskId: targetId, type: "blocks" },
    });
    if (opts.json) {
      console.log(JSON.stringify(relation, null, 2));
    } else {
      console.log(`Task ${id} now blocks ${targetId}`);
    }
  });

taskCmd
  .command("unblock")
  .description("Remove a blocks relation between two tasks")
  .argument("<id>", "Task ID (the blocker)")
  .argument("<targetId>", "Task ID that was blocked")
  .option("--json", "Output raw JSON")
  .action(async (id: string, targetId: string, opts) => {
    const relations = await taskRelationsList(id);
    const edge = relations.find(
      (r) =>
        r.relation.type === "blocks" &&
        r.relation.fromTaskId === id &&
        r.relation.toTaskId === targetId,
    );
    if (!edge) {
      if (opts.json) {
        console.log(JSON.stringify({ message: "No blocking relation found" }));
      } else {
        console.log("No blocking relation found.");
      }
      return;
    }
    await taskRelationDelete(id, edge.relation.id);
    await logTaskCommandEvent({
      action: "task.relation.deleted",
      entityType: "task_relation",
      entityId: edge.relation.id,
      meta: {
        fromTaskId: edge.relation.fromTaskId,
        toTaskId: edge.relation.toTaskId,
        type: edge.relation.type,
      },
    });
    if (opts.json) {
      console.log(JSON.stringify({ message: "Relation removed" }));
    } else {
      console.log("Relation removed.");
    }
  });
