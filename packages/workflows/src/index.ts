import {
  and,
  asc,
  desc,
  eq,
  parseJsonObject,
  toJsonObject,
  workflowDefinitions,
  workflowRuns,
  workflowRunSteps,
  type DB,
  type WorkflowDefinition,
  type WorkflowRun,
  type WorkflowRunStep,
} from "@clawops/core";

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

export interface WorkflowStepDefinition {
  key?: string;
  name: string;
  type: WorkflowStepType;
  config?: Record<string, unknown>;
  condition?: string;
  onError?: "stop" | "continue" | "retry";
  retryCount?: number;
}

export interface WorkflowRecord extends WorkflowDefinition {
  triggerConfigObject: Record<string, unknown>;
  stepsArray: WorkflowStepDefinition[];
}

export interface WorkflowRunRecord extends WorkflowRun {
  resultObject: Record<string, unknown>;
  metadataObject: Record<string, unknown>;
}

export interface WorkflowStepRunRecord extends WorkflowRunStep {
  inputObject: Record<string, unknown>;
  resultObject: Record<string, unknown>;
}

export interface WorkflowRunWithSteps extends WorkflowRunRecord {
  steps: WorkflowStepRunRecord[];
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
  description?: string | null;
  version?: string;
  status?: WorkflowStatus;
  projectId?: string | null;
  triggerType?: WorkflowTriggerType;
  triggerConfig?: Record<string, unknown> | null;
  steps?: WorkflowStepDefinition[];
}

export interface ListWorkflowsFilters {
  status?: WorkflowStatus;
  projectId?: string;
  triggerType?: WorkflowTriggerType;
}

export interface CreateWorkflowRunInput {
  workflowId: string;
  triggeredBy: "human" | "agent" | "schedule" | "event";
  triggeredById?: string;
  status?: WorkflowRunStatus;
  startedAt?: Date;
  completedAt?: Date;
  result?: Record<string, unknown>;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateWorkflowRunInput {
  status?: WorkflowRunStatus;
  startedAt?: Date | null;
  completedAt?: Date | null;
  result?: Record<string, unknown> | null;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateWorkflowRunStepInput {
  workflowRunId: string;
  stepIndex: number;
  stepKey?: string;
  stepName: string;
  stepType: WorkflowStepType;
  status?: WorkflowStepRunStatus;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface UpdateWorkflowRunStepInput {
  status?: WorkflowStepRunStatus;
  input?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
  error?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
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

function serializeObject(value: Record<string, unknown> | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  return toJsonObject(value);
}

function serializeSteps(steps: WorkflowStepDefinition[]): string {
  return JSON.stringify(steps);
}

function parseSteps(steps: string): WorkflowStepDefinition[] {
  try {
    const parsed: unknown = JSON.parse(steps);
    if (!Array.isArray(parsed)) {
      throw new Error("Workflow steps must deserialize to an array");
    }

    return parsed as WorkflowStepDefinition[];
  } catch (error) {
    throw new Error(
      `Workflow steps must be valid JSON: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

function toWorkflowRecord(row: WorkflowDefinition): WorkflowRecord {
  return {
    ...row,
    triggerConfigObject: parseJsonObject(row.triggerConfig),
    stepsArray: parseSteps(row.steps),
  };
}

function toWorkflowRunRecord(row: WorkflowRun): WorkflowRunRecord {
  return {
    ...row,
    resultObject: parseJsonObject(row.result),
    metadataObject: parseJsonObject(row.metadata),
  };
}

function toWorkflowStepRunRecord(row: WorkflowRunStep): WorkflowStepRunRecord {
  return {
    ...row,
    inputObject: parseJsonObject(row.input),
    resultObject: parseJsonObject(row.result),
  };
}

function buildWorkflowFilter(filters: ListWorkflowsFilters = {}) {
  const conditions = [];

  if (filters.status) {
    conditions.push(eq(workflowDefinitions.status, filters.status));
  }
  if (filters.projectId) {
    conditions.push(eq(workflowDefinitions.projectId, filters.projectId));
  }
  if (filters.triggerType) {
    conditions.push(eq(workflowDefinitions.triggerType, filters.triggerType));
  }

  if (conditions.length === 0) {
    return undefined;
  }

  return conditions.length === 1 ? conditions[0] : and(...conditions);
}

function normalizeStepKey(step: WorkflowStepDefinition, index: number): string {
  return step.key?.trim() || `step-${index + 1}`;
}

function normalizeWorkflowStep(step: WorkflowStepDefinition, index: number): WorkflowStepDefinition {
  return {
    ...step,
    key: normalizeStepKey(step, index),
    config: step.config ?? {},
  };
}

function normalizeCreateInput(input: CreateWorkflowInput) {
  validateCreateWorkflow(input);
  const triggerType = input.triggerType ?? "manual";
  validateTriggerConfig(triggerType, input.triggerConfig);

  const normalizedSteps = input.steps.map(normalizeWorkflowStep);

  return {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    version: input.version?.trim() || "1",
    status: input.status ?? "draft",
    projectId: input.projectId ?? null,
    triggerType,
    triggerConfig: serializeObject(input.triggerConfig),
    steps: serializeSteps(normalizedSteps),
  };
}

function normalizeUpdateInput(input: UpdateWorkflowInput) {
  validateUpdateWorkflow(input);

  const triggerType = input.triggerType;
  if (triggerType) {
    validateTriggerConfig(triggerType, input.triggerConfig ?? undefined);
  }

  return {
    name: input.name?.trim(),
    description: input.description === undefined ? undefined : (input.description?.trim() || null),
    version: input.version?.trim(),
    status: input.status,
    projectId: input.projectId,
    triggerType,
    triggerConfig:
      input.triggerConfig === undefined ? undefined : serializeObject(input.triggerConfig),
    steps:
      input.steps === undefined
        ? undefined
        : serializeSteps(input.steps.map(normalizeWorkflowStep)),
    updatedAt: new Date(),
  };
}

function getReturningRow<T>(row: T | undefined | null, entity: string): T {
  if (!row) {
    throw new Error(`Failed to persist ${entity}`);
  }

  return row;
}

function validateWorkflowStepArray(steps: WorkflowStepDefinition[]): void {
  if (steps.length === 0) {
    throw new Error("Workflow must have at least one step");
  }

  for (const [index, step] of steps.entries()) {
    validateWorkflowStep(step, index);

    if (step.type === "parallel") {
      const nestedSteps = step.config?.["steps"];
      if (!Array.isArray(nestedSteps)) {
        throw new Error(
          `Step ${index} (${step.name}): parallel steps must have a "steps" array in config`,
        );
      }
    }
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

export function createWorkflowDefinition(db: DB, input: CreateWorkflowInput): WorkflowRecord {
  const row = db
    .insert(workflowDefinitions)
    .values(normalizeCreateInput(input))
    .returning()
    .get();

  return toWorkflowRecord(getReturningRow(row, "workflow definition"));
}

export function getWorkflowDefinition(db: DB, id: string): WorkflowRecord | null {
  const row = db
    .select()
    .from(workflowDefinitions)
    .where(eq(workflowDefinitions.id, id))
    .get();

  return row ? toWorkflowRecord(row) : null;
}

export function listWorkflowDefinitions(
  db: DB,
  filters: ListWorkflowsFilters = {},
): WorkflowRecord[] {
  const whereClause = buildWorkflowFilter(filters);
  const query = db.select().from(workflowDefinitions);
  const rows = whereClause ? query.where(whereClause).orderBy(desc(workflowDefinitions.updatedAt)).all() : query.orderBy(desc(workflowDefinitions.updatedAt)).all();
  return rows.map(toWorkflowRecord);
}

export function updateWorkflowDefinition(
  db: DB,
  id: string,
  input: UpdateWorkflowInput,
): WorkflowRecord {
  const row = db
    .update(workflowDefinitions)
    .set(normalizeUpdateInput(input))
    .where(eq(workflowDefinitions.id, id))
    .returning()
    .get();

  return toWorkflowRecord(getReturningRow(row, "workflow definition"));
}

export function createWorkflowRun(db: DB, input: CreateWorkflowRunInput): WorkflowRunRecord {
  const row = db
    .insert(workflowRuns)
    .values({
      workflowId: input.workflowId,
      triggeredBy: input.triggeredBy,
      triggeredById: input.triggeredById ?? null,
      status: input.status ?? "pending",
      startedAt: input.startedAt ?? null,
      completedAt: input.completedAt ?? null,
      result: serializeObject(input.result),
      error: input.error ?? null,
      metadata: serializeObject(input.metadata),
    })
    .returning()
    .get();

  return toWorkflowRunRecord(getReturningRow(row, "workflow run"));
}

export function updateWorkflowRun(
  db: DB,
  id: string,
  input: UpdateWorkflowRunInput,
): WorkflowRunRecord {
  const row = db
    .update(workflowRuns)
    .set({
      status: input.status,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      result: input.result === undefined ? undefined : serializeObject(input.result),
      error: input.error,
      metadata:
        input.metadata === undefined ? undefined : serializeObject(input.metadata),
    })
    .where(eq(workflowRuns.id, id))
    .returning()
    .get();

  return toWorkflowRunRecord(getReturningRow(row, "workflow run"));
}

export function listWorkflowRuns(db: DB, workflowId: string): WorkflowRunRecord[] {
  return db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.workflowId, workflowId))
    .orderBy(desc(workflowRuns.createdAt))
    .all()
    .map(toWorkflowRunRecord);
}

export function getWorkflowRun(db: DB, id: string): WorkflowRunWithSteps | null {
  const run = db.select().from(workflowRuns).where(eq(workflowRuns.id, id)).get();
  if (!run) {
    return null;
  }

  return {
    ...toWorkflowRunRecord(run),
    steps: listWorkflowRunSteps(db, id),
  };
}

export function createWorkflowRunStep(
  db: DB,
  input: CreateWorkflowRunStepInput,
): WorkflowStepRunRecord {
  const row = db
    .insert(workflowRunSteps)
    .values({
      workflowRunId: input.workflowRunId,
      stepIndex: input.stepIndex,
      stepKey: input.stepKey ?? `step-${input.stepIndex + 1}`,
      stepName: input.stepName,
      stepType: input.stepType,
      status: input.status ?? "pending",
      input: serializeObject(input.input),
      result: serializeObject(input.result),
      error: input.error ?? null,
      startedAt: input.startedAt ?? null,
      completedAt: input.completedAt ?? null,
    })
    .returning()
    .get();

  return toWorkflowStepRunRecord(getReturningRow(row, "workflow run step"));
}

export function updateWorkflowRunStep(
  db: DB,
  id: string,
  input: UpdateWorkflowRunStepInput,
): WorkflowStepRunRecord {
  const row = db
    .update(workflowRunSteps)
    .set({
      status: input.status,
      input: input.input === undefined ? undefined : serializeObject(input.input),
      result: input.result === undefined ? undefined : serializeObject(input.result),
      error: input.error,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
    })
    .where(eq(workflowRunSteps.id, id))
    .returning()
    .get();

  return toWorkflowStepRunRecord(getReturningRow(row, "workflow run step"));
}

export function listWorkflowRunSteps(
  db: DB,
  workflowRunId: string,
): WorkflowStepRunRecord[] {
  return db
    .select()
    .from(workflowRunSteps)
    .where(eq(workflowRunSteps.workflowRunId, workflowRunId))
    .orderBy(asc(workflowRunSteps.stepIndex))
    .all()
    .map(toWorkflowStepRunRecord);
}
