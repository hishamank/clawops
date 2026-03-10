export type WorkflowStatus = "draft" | "active" | "paused" | "deprecated";

export type WorkflowTriggerType = "manual" | "scheduled" | "event" | "webhook";

export type WorkflowRunStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type WorkflowStepRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type WorkflowStepType =
  | "task"
  | "agent"
  | "script"
  | "condition"
  | "parallel"
  | "wait"
  | "webhook"
  | "notification";

export interface WorkflowRecord {
  id: string;
  name: string;
  description: string | null;
  version: string;
  status: WorkflowStatus;
  projectId: string | null;
  triggerType: WorkflowTriggerType;
  triggerConfig: string | null;
  steps: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowRunRecord {
  id: string;
  workflowId: string;
  status: WorkflowRunStatus;
  triggeredBy: string | null;
  triggeredById: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
  metadata: string | null;
  createdAt: Date;
}

export interface WorkflowStepRunRecord {
  id: string;
  runId: string;
  stepIndex: number;
  name: string;
  type: string;
  status: WorkflowStepRunStatus;
  input: string | null;
  output: string | null;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface WorkflowStepDefinition {
  name: string;
  type: WorkflowStepType;
  config?: Record<string, unknown>;
  condition?: string;
  onError?: "stop" | "continue" | "retry";
  retryCount?: number;
}

export interface WorkflowStepState {
  index: number;
  name: string;
  type: WorkflowStepType;
  status: WorkflowStepRunStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface WorkflowContext {
  workflowId: string;
  runId: string;
  triggeredBy: string;
  triggeredById?: string;
  variables: Record<string, unknown>;
  stepOutputs: Record<string, Record<string, unknown>>;
  metadata?: Record<string, unknown>;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  version?: string;
  status?: WorkflowStatus;
  projectId?: string;
  triggerType?: WorkflowTriggerType;
  triggerConfig?: Record<string, unknown>;
  steps: WorkflowStepDefinition[];
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  version?: string;
  status?: WorkflowStatus;
  triggerType?: WorkflowTriggerType;
  triggerConfig?: Record<string, unknown>;
  steps?: WorkflowStepDefinition[];
}

export interface ListWorkflowsFilters {
  status?: WorkflowStatus;
  projectId?: string;
  triggerType?: WorkflowTriggerType;
}

export interface RunWorkflowInput {
  triggeredBy: "human" | "agent" | "schedule" | "event";
  triggeredById?: string;
  variables?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface WorkflowWithRuns extends WorkflowRecord {
  runs: WorkflowRunRecord[];
}

export interface WorkflowRunWithSteps extends WorkflowRunRecord {
  steps: WorkflowStepRunRecord[];
}

export interface WorkflowService {
  createWorkflow(input: CreateWorkflowInput): WorkflowRecord;
  getWorkflow(id: string): WorkflowWithRuns | null;
  listWorkflows(filters?: ListWorkflowsFilters): WorkflowRecord[];
  updateWorkflow(id: string, updates: UpdateWorkflowInput): WorkflowRecord;
  deleteWorkflow(id: string): void;
  runWorkflow(id: string, input: RunWorkflowInput): WorkflowRunRecord;
  getWorkflowRun(runId: string): WorkflowRunWithSteps | null;
  listWorkflowRuns(workflowId: string): WorkflowRunRecord[];
  cancelWorkflowRun(runId: string): WorkflowRunRecord;
  getWorkflowStepRuns(runId: string): WorkflowStepRunRecord[];
}

const VALID_STEP_TYPES: WorkflowStepType[] = [
  "task",
  "agent",
  "script",
  "condition",
  "parallel",
  "wait",
  "webhook",
  "notification",
];

function validateParallelStepConfig(
  step: WorkflowStepDefinition,
  index: number,
): void {
  if (step.type !== "parallel") {
    return;
  }

  const nestedSteps = step.config?.["steps"];
  if (!Array.isArray(nestedSteps)) {
    throw new Error(
      `Step ${index} (${step.name}): parallel steps must have a "steps" array in config`,
    );
  }
}

function validateWorkflowStepArray(steps: WorkflowStepDefinition[]): void {
  if (steps.length === 0) {
    throw new Error("Workflow must have at least one step");
  }

  for (const [index, step] of steps.entries()) {
    validateWorkflowStep(step, index);
    validateParallelStepConfig(step, index);
  }
}

export function validateWorkflowStep(
  step: WorkflowStepDefinition,
  index: number,
): asserts step is WorkflowStepDefinition {
  if (!step.name || typeof step.name !== "string") {
    throw new Error(`Step ${index}: name is required and must be a string`);
  }

  if (!VALID_STEP_TYPES.includes(step.type)) {
    throw new Error(
      `Step ${index} (${step.name}): invalid type "${step.type}". Must be one of: ${VALID_STEP_TYPES.join(", ")}`,
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

export function validateCreateWorkflow(input: CreateWorkflowInput): void {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error("Workflow name is required");
  }

  if (!Array.isArray(input.steps)) {
    throw new Error("Workflow steps must be an array");
  }

  validateWorkflowStepArray(input.steps);
}

export function validateUpdateWorkflow(input: UpdateWorkflowInput): void {
  if (input.name !== undefined && input.name.trim().length === 0) {
    throw new Error("Workflow name cannot be empty");
  }

  if (input.steps !== undefined) {
    if (!Array.isArray(input.steps)) {
      throw new Error("Workflow steps must be an array");
    }

    validateWorkflowStepArray(input.steps);
  }
}

export function validateWorkflow(
  input: CreateWorkflowInput | UpdateWorkflowInput,
): void {
  if ("steps" in input && Array.isArray(input.steps) && "name" in input) {
    if (input.name === undefined) {
      validateUpdateWorkflow(input);
      return;
    }
  }

  if ("name" in input && input.name !== undefined && "steps" in input && input.steps !== undefined) {
    validateCreateWorkflow(input as CreateWorkflowInput);
    return;
  }

  validateUpdateWorkflow(input as UpdateWorkflowInput);
}

export function validateTriggerConfig(
  triggerType: WorkflowTriggerType,
  triggerConfig?: Record<string, unknown>,
): void {
  if (triggerType === "manual") {
    return;
  }

  if (!triggerConfig) {
    throw new Error(
      `Trigger config is required for trigger type "${triggerType}"`,
    );
  }

  switch (triggerType) {
    case "scheduled":
      if (!triggerConfig["cronExpr"] && !triggerConfig["interval"]) {
        throw new Error(
          'Scheduled trigger requires "cronExpr" or "interval" in config',
        );
      }
      break;
    case "event":
      if (!triggerConfig["eventType"]) {
        throw new Error('Event trigger requires "eventType" in config');
      }
      break;
    case "webhook":
      if (!triggerConfig["path"]) {
        throw new Error('Webhook trigger requires "path" in config');
      }
      break;
  }
}
