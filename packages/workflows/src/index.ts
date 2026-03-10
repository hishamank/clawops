import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import crypto from "node:crypto";

// ── Workflows ───────────────────────────────────────────────────────────────

/**
 * A workflow is a reusable sequence of steps that can be executed to achieve
 * a specific goal. Workflows are defined once and can be run multiple times.
 */
export const workflows = sqliteTable("workflows", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  version: text("version").notNull().default("1.0.0"),
  status: text("status", {
    enum: ["draft", "active", "paused", "deprecated"],
  })
    .notNull()
    .default("draft"),
  projectId: text("project_id"),
  triggerType: text("trigger_type", {
    enum: ["manual", "scheduled", "event", "webhook"],
  })
    .notNull()
    .default("manual"),
  triggerConfig: text("trigger_config"), // JSON object for schedule/event/webhook config
  steps: text("steps").notNull(), // JSON array of step definitions
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Workflow Runs ───────────────────────────────────────────────────────────

/**
 * A workflow run is a single execution of a workflow.
 * Tracks the overall state and timing of the execution.
 */
export const workflowRuns = sqliteTable("workflow_runs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workflowId: text("workflow_id")
    .notNull()
    .references(() => workflows.id),
  status: text("status", {
    enum: ["pending", "running", "paused", "completed", "failed", "cancelled"],
  })
    .notNull()
    .default("pending"),
  triggeredBy: text("triggered_by"), // "human", "agent", "schedule", "event"
  triggeredById: text("triggered_by_id"), // agentId, userId, etc.
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  error: text("error"), // Error message if failed
  metadata: text("metadata"), // JSON object for run-specific context
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Workflow Steps ──────────────────────────────────────────────────────────

/**
 * Individual step execution records within a workflow run.
 * Each step in a workflow definition gets one record per run.
 */
export const workflowStepRuns = sqliteTable("workflow_step_runs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  runId: text("run_id")
    .notNull()
    .references(() => workflowRuns.id),
  stepIndex: integer("step_index").notNull(), // Order in the workflow
  name: text("name").notNull(), // Step name from definition
  type: text("type").notNull(), // Step type: "task", "agent", "script", "condition", etc.
  status: text("status", {
    enum: ["pending", "running", "completed", "failed", "skipped"],
  })
    .notNull()
    .default("pending"),
  input: text("input"), // JSON object - input passed to the step
  output: text("output"), // JSON object - output from the step
  error: text("error"), // Error message if failed
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Inferred Types ──────────────────────────────────────────────────────────

export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;

export type WorkflowRun = typeof workflowRuns.$inferSelect;
export type NewWorkflowRun = typeof workflowRuns.$inferInsert;

export type WorkflowStepRun = typeof workflowStepRuns.$inferSelect;
export type NewWorkflowStepRun = typeof workflowStepRuns.$inferInsert;

// ── Step Type Definitions ───────────────────────────────────────────────────

/**
 * Base step definition used in workflow.steps JSON array.
 */
export interface WorkflowStepDefinition {
  name: string;
  type: WorkflowStepType;
  config?: Record<string, unknown>;
  condition?: string; // Optional condition expression
  onError?: "stop" | "continue" | "retry";
  retryCount?: number;
}

export type WorkflowStepType =
  | "task"        // Create/update a task
  | "agent"       // Invoke an agent
  | "script"      // Run a script/command
  | "condition"   // Conditional branching
  | "parallel"    // Run steps in parallel
  | "wait"        // Wait for event or duration
  | "webhook"     // Call external webhook
  | "notification"; // Send notification

/**
 * Runtime step state during execution.
 */
export interface WorkflowStepState {
  index: number;
  name: string;
  type: WorkflowStepType;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

// ── Workflow Execution Context ──────────────────────────────────────────────

/**
 * Context passed through workflow execution.
 * Accumulates outputs from completed steps.
 */
export interface WorkflowContext {
  workflowId: string;
  runId: string;
  triggeredBy: string;
  triggeredById?: string;
  variables: Record<string, unknown>;
  stepOutputs: Record<string, Record<string, unknown>>; // keyed by step name
  metadata?: Record<string, unknown>;
}

// ── Workflow Service Interfaces ─────────────────────────────────────────────

/**
 * Service interface for workflow operations.
 * Implemented by the workflows package.
 */
export interface WorkflowService {
  /**
   * Create a new workflow definition.
   */
  createWorkflow(input: CreateWorkflowInput): Workflow;

  /**
   * Get a workflow by ID with its run history.
   */
  getWorkflow(id: string): WorkflowWithRuns | null;

  /**
   * List workflows with optional filters.
   */
  listWorkflows(filters?: ListWorkflowsFilters): Workflow[];

  /**
   * Update a workflow definition.
   */
  updateWorkflow(id: string, updates: UpdateWorkflowInput): Workflow;

  /**
   * Delete a workflow (soft delete by setting status to deprecated).
   */
  deleteWorkflow(id: string): void;

  /**
   * Execute a workflow.
   */
  runWorkflow(id: string, input: RunWorkflowInput): WorkflowRun;

  /**
   * Get a specific workflow run.
   */
  getWorkflowRun(runId: string): WorkflowRunWithSteps | null;

  /**
   * List runs for a workflow.
   */
  listWorkflowRuns(workflowId: string): WorkflowRun[];

  /**
   * Cancel a running workflow.
   */
  cancelWorkflowRun(runId: string): WorkflowRun;

  /**
   * Get step executions for a run.
   */
  getWorkflowStepRuns(runId: string): WorkflowStepRun[];
}

// ── Input Types ─────────────────────────────────────────────────────────────

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  version?: string;
  status?: Workflow["status"];
  projectId?: string;
  triggerType?: Workflow["triggerType"];
  triggerConfig?: Record<string, unknown>;
  steps: WorkflowStepDefinition[];
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  version?: string;
  status?: Workflow["status"];
  triggerConfig?: Record<string, unknown>;
  steps?: WorkflowStepDefinition[];
}

export interface ListWorkflowsFilters {
  status?: Workflow["status"];
  projectId?: string;
  triggerType?: Workflow["triggerType"];
}

export interface RunWorkflowInput {
  triggeredBy: "human" | "agent" | "schedule" | "event";
  triggeredById?: string;
  variables?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// ── Enriched Types ──────────────────────────────────────────────────────────

export interface WorkflowWithRuns extends Workflow {
  runs: WorkflowRun[];
}

export interface WorkflowRunWithSteps extends WorkflowRun {
  steps: WorkflowStepRun[];
}

// ── Validators ──────────────────────────────────────────────────────────────

/**
 * Validate a workflow step definition.
 * Returns true if valid, throws error with details if invalid.
 */
export function validateWorkflowStep(
  step: WorkflowStepDefinition,
  index: number,
): asserts step is WorkflowStepDefinition {
  if (!step.name || typeof step.name !== "string") {
    throw new Error(`Step ${index}: name is required and must be a string`);
  }

  const validTypes: WorkflowStepType[] = [
    "task",
    "agent",
    "script",
    "condition",
    "parallel",
    "wait",
    "webhook",
    "notification",
  ];

  if (!validTypes.includes(step.type)) {
    throw new Error(
      `Step ${index} (${step.name}): invalid type "${step.type}". Must be one of: ${validTypes.join(", ")}`,
    );
  }

  if (step.onError && !["stop", "continue", "retry"].includes(step.onError)) {
    throw new Error(
      `Step ${index} (${step.name}): invalid onError value. Must be "stop", "continue", or "retry"`,
    );
  }

  if (step.retryCount != null && (step.retryCount < 0 || step.retryCount > 10)) {
    throw new Error(
      `Step ${index} (${step.name}): retryCount must be between 0 and 10`,
    );
  }
}

/**
 * Validate a complete workflow definition.
 */
export function validateWorkflow(
  input: CreateWorkflowInput | UpdateWorkflowInput,
): void {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error("Workflow name is required");
  }

  if (!input.steps || !Array.isArray(input.steps)) {
    throw new Error("Workflow steps must be an array");
  }

  if (input.steps.length === 0) {
    throw new Error("Workflow must have at least one step");
  }

  // Validate each step
  input.steps.forEach((step, index) => {
    validateWorkflowStep(step, index);
  });

  // Validate parallel steps have nested steps
  input.steps.forEach((step, index) => {
    if (step.type === "parallel") {
      const config = step.config as { steps?: unknown } | undefined;
      if (!config?.steps || !Array.isArray(config.steps)) {
        throw new Error(
          `Step ${index} (${step.name}): parallel steps must have a "steps" array in config`,
        );
      }
    }
  });
}

/**
 * Validate workflow trigger configuration based on trigger type.
 */
export function validateTriggerConfig(
  triggerType: Workflow["triggerType"],
  triggerConfig?: Record<string, unknown>,
): void {
  if (triggerType === "manual") {
    // No config needed for manual trigger
    return;
  }

  if (!triggerConfig) {
    throw new Error(
      `Trigger config is required for trigger type "${triggerType}"`,
    );
  }

  switch (triggerType) {
    case "scheduled":
      if (!triggerConfig.cronExpr && !triggerConfig.interval) {
        throw new Error(
          'Scheduled trigger requires "cronExpr" or "interval" in config',
        );
      }
      break;

    case "event":
      if (!triggerConfig.eventType) {
        throw new Error('Event trigger requires "eventType" in config');
      }
      break;

    case "webhook":
      if (!triggerConfig.path) {
        throw new Error('Webhook trigger requires "path" in config');
      }
      break;
  }
}
