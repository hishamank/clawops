/* eslint-disable no-console -- CLI tool uses console for output */

import { Command } from "commander";
import * as fs from "node:fs";
import {
  workflowCreate,
  workflowGet,
  workflowList,
  workflowUpdate,
  workflowRunCreate,
  workflowRunList,
  workflowRunGet,
  type WorkflowStepDefinition,
} from "../lib/client.js";

const VALID_STATUSES = ["draft", "active", "paused", "deprecated"] as const;
const VALID_TRIGGER_TYPES = ["manual", "scheduled", "event", "webhook"] as const;
const VALID_TRIGGERED_BY = ["human", "agent", "schedule", "event"] as const;

type ValidStatus = typeof VALID_STATUSES[number];
type ValidTriggerType = typeof VALID_TRIGGER_TYPES[number];
type ValidTriggeredBy = typeof VALID_TRIGGERED_BY[number];

function validateStatus(value: string | undefined, fieldName: string): ValidStatus | undefined {
  if (value === undefined) return undefined;
  if (!VALID_STATUSES.includes(value as ValidStatus)) {
    console.error(`Invalid ${fieldName}: ${value}. Must be one of: ${VALID_STATUSES.join(", ")}`);
    process.exit(1);
  }
  return value as ValidStatus;
}

function validateTriggerType(value: string | undefined, fieldName: string): ValidTriggerType | undefined {
  if (value === undefined) return undefined;
  if (!VALID_TRIGGER_TYPES.includes(value as ValidTriggerType)) {
    console.error(`Invalid ${fieldName}: ${value}. Must be one of: ${VALID_TRIGGER_TYPES.join(", ")}`);
    process.exit(1);
  }
  return value as ValidTriggerType;
}

function validateTriggeredBy(value: string, fieldName: string): ValidTriggeredBy {
  if (!VALID_TRIGGERED_BY.includes(value as ValidTriggeredBy)) {
    console.error(`Invalid ${fieldName}: ${value}. Must be one of: ${VALID_TRIGGERED_BY.join(", ")}`);
    process.exit(1);
  }
  return value as ValidTriggeredBy;
}

export const workflowCmd = new Command("workflow").description("Manage workflows");

workflowCmd
  .command("create")
  .description("Create a new workflow")
  .requiredOption("--name <name>", "Workflow name")
  .option("--desc <description>", "Workflow description")
  .option("--status <status>", "Workflow status", "draft")
  .option("--trigger-type <type>", "Trigger type", "manual")
  .option("--trigger-config <json>", "Trigger config as JSON string")
  .option("--project <id>", "Project ID")
  .requiredOption("--steps <file>", "Path to steps JSON file")
  .option("--json", "Output raw JSON")
  .action(async (opts) => {
    const status = validateStatus(opts.status, "status");
    const triggerType = validateTriggerType(opts.triggerType, "trigger-type");

    let triggerConfig: Record<string, unknown> | undefined;
    if (opts.triggerConfig) {
      try {
        const parsed = JSON.parse(opts.triggerConfig) as unknown;
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          console.error("--trigger-config must be a JSON object (e.g., '{\"key\": \"value\"}')");
          process.exit(1);
        }
        triggerConfig = parsed as Record<string, unknown>;
      } catch {
        console.error("Invalid JSON for --trigger-config");
        process.exit(1);
      }
    }

    let steps: WorkflowStepDefinition[];
    try {
      const content = fs.readFileSync(opts.steps, "utf-8");
      const parsed = JSON.parse(content) as unknown;
      if (!Array.isArray(parsed)) {
        console.error("Steps file must contain a JSON array");
        process.exit(1);
      }
      for (const [index, step] of parsed.entries()) {
        if (step === null || typeof step !== "object" || Array.isArray(step)) {
          console.error(`Step ${index} must be an object`);
          process.exit(1);
        }
        const stepObj = step as Record<string, unknown>;
        if (!stepObj.name || typeof stepObj.name !== "string") {
          console.error(`Step ${index}: name is required and must be a string`);
          process.exit(1);
        }
        if (!stepObj.type || typeof stepObj.type !== "string") {
          console.error(`Step ${index}: type is required and must be a string`);
          process.exit(1);
        }
      }
      steps = parsed as WorkflowStepDefinition[];
    } catch (err) {
      console.error(`Failed to read steps file: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }

    const workflow = await workflowCreate({
      name: opts.name,
      description: opts.desc,
      status,
      triggerType,
      triggerConfig,
      projectId: opts.project,
      steps,
    });

    if (opts.json) {
      console.log(JSON.stringify(workflow, null, 2));
    } else {
      console.log(`Created workflow ${workflow.id}: ${workflow.name}`);
    }
  });

workflowCmd
  .command("list")
  .description("List workflows")
  .option("--status <status>", "Filter by status")
  .option("--trigger-type <type>", "Filter by trigger type")
  .option("--project <id>", "Filter by project")
  .option("--json", "Output raw JSON")
  .action(async (opts) => {
    const status = validateStatus(opts.status, "status");
    const triggerType = validateTriggerType(opts.triggerType, "trigger-type");

    const workflows = await workflowList({
      status,
      triggerType,
      projectId: opts.project,
    });

    if (opts.json) {
      console.log(JSON.stringify(workflows, null, 2));
    } else if (workflows.length === 0) {
      console.log("No workflows found.");
    } else {
      for (const w of workflows) {
        console.log(`[${w.status}] ${w.id}  ${w.name} (${w.triggerType})`);
      }
    }
  });

workflowCmd
  .command("inspect")
  .description("Inspect a workflow")
  .argument("<id>", "Workflow ID")
  .option("--json", "Output raw JSON")
  .action(async (id: string, opts) => {
    const workflow = await workflowGet(id);

    if (!workflow) {
      console.error(`Workflow not found: ${id}`);
      process.exit(1);
    }

    if (opts.json) {
      console.log(JSON.stringify(workflow, null, 2));
    } else {
      console.log(`ID:        ${workflow.id}`);
      console.log(`Name:      ${workflow.name}`);
      console.log(`Status:    ${workflow.status}`);
      console.log(`Trigger:   ${workflow.triggerType}`);
      console.log(`Project:   ${workflow.projectId ?? "(none)"}`);
      console.log(`Version:   ${workflow.version}`);
      console.log(`Created:   ${workflow.createdAt}`);
      console.log(`Updated:   ${workflow.updatedAt}`);
      if (workflow.description) {
        console.log(`\nDescription:\n${workflow.description}`);
      }
      console.log(`\nSteps:`);
      for (const step of workflow.stepsArray) {
        console.log(`  - ${step.name} (${step.type})`);
      }
    }
  });

workflowCmd
  .command("update")
  .description("Update a workflow")
  .argument("<id>", "Workflow ID")
  .option("--name <name>", "Workflow name")
  .option("--desc <description>", "Workflow description")
  .option("--status <status>", "Workflow status")
  .option("--trigger-type <type>", "Trigger type")
  .option("--trigger-config <json>", "Trigger config as JSON string")
  .option("--steps <file>", "Path to steps JSON file")
  .option("--json", "Output raw JSON")
  .action(async (id: string, opts) => {
    const status = validateStatus(opts.status, "status");
    const triggerType = validateTriggerType(opts.triggerType, "trigger-type");

    let triggerConfig: Record<string, unknown> | null | undefined;
    if (opts.triggerConfig !== undefined) {
      if (opts.triggerConfig === "null") {
        triggerConfig = null;
      } else {
        try {
          const parsed = JSON.parse(opts.triggerConfig) as unknown;
          if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            console.error("--trigger-config must be a JSON object (e.g., '{\"key\": \"value\"}')");
            process.exit(1);
          }
          triggerConfig = parsed as Record<string, unknown>;
        } catch {
          console.error("Invalid JSON for --trigger-config");
          process.exit(1);
        }
      }
    }

    let steps: WorkflowStepDefinition[] | undefined;
    if (opts.steps) {
      try {
        const content = fs.readFileSync(opts.steps, "utf-8");
        const parsed = JSON.parse(content) as unknown;
        if (!Array.isArray(parsed)) {
          console.error("Steps file must contain a JSON array");
          process.exit(1);
        }
        for (const [index, step] of parsed.entries()) {
          if (step === null || typeof step !== "object" || Array.isArray(step)) {
            console.error(`Step ${index} must be an object`);
            process.exit(1);
          }
          const stepObj = step as Record<string, unknown>;
          if (!stepObj.name || typeof stepObj.name !== "string") {
            console.error(`Step ${index}: name is required and must be a string`);
            process.exit(1);
          }
          if (!stepObj.type || typeof stepObj.type !== "string") {
            console.error(`Step ${index}: type is required and must be a string`);
            process.exit(1);
          }
        }
        steps = parsed as WorkflowStepDefinition[];
      } catch (err) {
        console.error(`Failed to read steps file: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    }

    const workflow = await workflowUpdate(id, {
      name: opts.name,
      description: opts.desc,
      status,
      triggerType,
      triggerConfig,
      steps,
    });

    if (opts.json) {
      console.log(JSON.stringify(workflow, null, 2));
    } else {
      console.log(`Updated workflow ${workflow.id}: ${workflow.name}`);
    }
  });

workflowCmd
  .command("run")
  .description("Trigger a workflow run")
  .argument("<workflow-id>", "Workflow ID")
  .option("--triggered-by <source>", "Trigger source", "human")
  .option("--triggered-by-id <id>", "ID of the trigger source")
  .option("--json", "Output raw JSON")
  .action(async (workflowId: string, opts) => {
    const triggeredBy = validateTriggeredBy(opts.triggeredBy, "triggered-by");

    const run = await workflowRunCreate({
      workflowId,
      triggeredBy,
      triggeredById: opts.triggeredById,
    });

    if (opts.json) {
      console.log(JSON.stringify(run, null, 2));
    } else {
      console.log(`Started workflow run ${run.id} for workflow ${workflowId}`);
    }
  });

workflowCmd
  .command("runs")
  .description("List workflow runs")
  .argument("<workflow-id>", "Workflow ID")
  .option("--json", "Output raw JSON")
  .action(async (workflowId: string, opts) => {
    const runs = await workflowRunList(workflowId);

    if (opts.json) {
      console.log(JSON.stringify(runs, null, 2));
    } else if (runs.length === 0) {
      console.log("No workflow runs found.");
    } else {
      for (const r of runs) {
        console.log(`[${r.status}] ${r.id}  triggered by ${r.triggeredBy}  ${r.createdAt}`);
      }
    }
  });

workflowCmd
  .command("inspect-run")
  .description("Inspect a workflow run")
  .argument("<run-id>", "Workflow run ID")
  .option("--json", "Output raw JSON")
  .action(async (runId: string, opts) => {
    const run = await workflowRunGet(runId);

    if (!run) {
      console.error(`Workflow run not found: ${runId}`);
      process.exit(1);
    }

    if (opts.json) {
      console.log(JSON.stringify(run, null, 2));
    } else {
      console.log(`Run ID:       ${run.id}`);
      console.log(`Workflow:     ${run.workflowId}`);
      console.log(`Status:       ${run.status}`);
      console.log(`Triggered By: ${run.triggeredBy}`);
      console.log(`Started:      ${run.startedAt ?? "(not started)"}`);
      console.log(`Completed:    ${run.completedAt ?? "(not completed)"}`);
      if (run.error) {
        console.log(`Error:        ${run.error}`);
      }
      if (run.result) {
        console.log(`\nResult:`);
        console.log(JSON.stringify(run.resultObject, null, 2));
      }
      console.log(`\nSteps:`);
      for (const step of run.steps) {
        console.log(`  [${step.status}] ${step.stepName} (${step.stepType})`);
        if (step.error) {
          console.log(`    Error: ${step.error}`);
        }
      }
    }
  });
