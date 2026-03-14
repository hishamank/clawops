import { and, desc, eq, type SQL } from "drizzle-orm";
import type { DB } from "./db.js";
import {
  activityEvents,
  type ActivityEvent,
  type ActivityEventSeverity,
  type ActivityEventSource,
  type NewActivityEvent,
  type NewWorkflowDefinition,
  type NewWorkflowRun,
  type NewWorkflowRunStep,
  type WorkflowDefinition,
  type WorkflowRun,
  type WorkflowRunStep,
  workflowDefinitions,
  workflowRunSteps,
  workflowRuns,
} from "./schema.js";

export function parseJsonArray(val: string | null): string[] {
  if (!val) return [];
  try {
    const parsed: unknown = JSON.parse(val);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
    return [];
  } catch {
    return [];
  }
}

export function toJsonArray(arr: string[]): string {
  return JSON.stringify(arr);
}

export function parseJsonObject(val: string | null): Record<string, unknown> {
  if (!val) return {};
  try {
    const parsed: unknown = JSON.parse(val);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

export function toJsonObject(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

// ── Activity Event Helpers ─────────────────────────────────────────────────

export interface ActivityEventFilters {
  type?: string;
  agentId?: string;
  entityType?: string;
  entityId?: string;
  projectId?: string;
  taskId?: string;
  severity?: ActivityEventSeverity;
  source?: ActivityEventSource;
  limit?: number;
  offset?: number;
}

function normalizeActivityEventMetadata(
  metadata: string | null | undefined,
): string | null {
  if (metadata == null) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(metadata);
  } catch {
    throw new Error("Activity event metadata must be a JSON object");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Activity event metadata must be a JSON object");
  }

  return toJsonObject(parsed as Record<string, unknown>);
}

/**
 * Normalizes an activity event input for insertion.
 * Re-serializes metadata so object-shaped JSON is stored consistently.
 *
 * Note: this is a data-normalizer, NOT a DB insert. Call it before inserting:
 *   `db.insert(activityEvents).values(normalizeActivityEvent(input)).run()`
 */
export function normalizeActivityEvent(
  event: Omit<NewActivityEvent, "id" | "createdAt">,
): NewActivityEvent {
  return {
    ...event,
    metadata: normalizeActivityEventMetadata(event.metadata),
  };
}

export function createActivityEvent(
  db: DB,
  event: Omit<NewActivityEvent, "id" | "createdAt">,
): ActivityEvent {
  return db
    .insert(activityEvents)
    .values(normalizeActivityEvent(event))
    .returning()
    .get();
}

export function buildActivityEventQueryConditions(
  filters: ActivityEventFilters,
): SQL[] {
  const conditions: SQL[] = [];

  if (filters.type) {
    conditions.push(eq(activityEvents.type, filters.type));
  }
  if (filters.agentId) {
    conditions.push(eq(activityEvents.agentId, filters.agentId));
  }
  if (filters.entityType) {
    conditions.push(eq(activityEvents.entityType, filters.entityType));
  }
  if (filters.entityId) {
    conditions.push(eq(activityEvents.entityId, filters.entityId));
  }
  if (filters.projectId) {
    conditions.push(eq(activityEvents.projectId, filters.projectId));
  }
  if (filters.taskId) {
    conditions.push(eq(activityEvents.taskId, filters.taskId));
  }
  if (filters.severity) {
    conditions.push(eq(activityEvents.severity, filters.severity));
  }
  if (filters.source) {
    conditions.push(eq(activityEvents.source, filters.source));
  }

  return conditions;
}

export function parseActivityEventMetadata(
  event: ActivityEvent,
): Record<string, unknown> {
  return parseJsonObject(event.metadata);
}

// ── Workflow Persistence Helpers ───────────────────────────────────────────

type JsonRecord = Record<string, unknown>;
type WorkflowStepDefinition = JsonRecord;

export interface WorkflowDefinitionRecord extends WorkflowDefinition {
  triggerConfigObject: JsonRecord;
  stepsArray: WorkflowStepDefinition[];
}

export interface WorkflowRunRecord extends WorkflowRun {
  resultObject: JsonRecord;
  metadataObject: JsonRecord;
}

export interface WorkflowRunStepRecord extends WorkflowRunStep {
  inputObject: JsonRecord;
  resultObject: JsonRecord;
}

export interface ListWorkflowDefinitionFilters {
  status?: NonNullable<NewWorkflowDefinition["status"]>;
  projectId?: string;
  triggerType?: NonNullable<NewWorkflowDefinition["triggerType"]>;
  limit?: number;
}

export interface CreateWorkflowDefinitionInput {
  name: string;
  description?: string | null;
  version?: string;
  status?: NonNullable<NewWorkflowDefinition["status"]>;
  projectId?: string | null;
  triggerType?: NonNullable<NewWorkflowDefinition["triggerType"]>;
  triggerConfig?: JsonRecord | null;
  steps: WorkflowStepDefinition[];
}

export interface StartWorkflowRunInput {
  workflowId: string;
  triggeredBy: NonNullable<NewWorkflowRun["triggeredBy"]>;
  triggeredById?: string | null;
  status?: NonNullable<NewWorkflowRun["status"]>;
  startedAt?: Date | null;
  result?: JsonRecord | null;
  error?: string | null;
  metadata?: JsonRecord | null;
}

export interface RecordWorkflowRunStepInput {
  workflowRunId: string;
  stepIndex: number;
  stepKey?: string;
  stepName: string;
  stepType: string;
  status?: NonNullable<NewWorkflowRunStep["status"]>;
  input?: JsonRecord | null;
  result?: JsonRecord | null;
  error?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

export interface FinishWorkflowRunInput {
  status?: Extract<
    NonNullable<NewWorkflowRun["status"]>,
    "completed" | "failed" | "cancelled"
  >;
  completedAt?: Date | null;
  result?: JsonRecord | null;
  error?: string | null;
  metadata?: JsonRecord | null;
}

function serializeJsonRecord(value: JsonRecord | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  return toJsonObject(value);
}

function serializeWorkflowSteps(steps: WorkflowStepDefinition[]): string {
  return JSON.stringify(steps);
}

function parseWorkflowSteps(steps: string): WorkflowStepDefinition[] {
  try {
    const parsed: unknown = JSON.parse(steps);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (step): step is WorkflowStepDefinition =>
        step !== null && typeof step === "object" && !Array.isArray(step),
    );
  } catch {
    return [];
  }
}

function toWorkflowDefinitionRecord(row: WorkflowDefinition): WorkflowDefinitionRecord {
  return {
    ...row,
    triggerConfigObject: parseJsonObject(row.triggerConfig),
    stepsArray: parseWorkflowSteps(row.steps),
  };
}

function toWorkflowRunRecord(row: WorkflowRun): WorkflowRunRecord {
  return {
    ...row,
    resultObject: parseJsonObject(row.result),
    metadataObject: parseJsonObject(row.metadata),
  };
}

function toWorkflowRunStepRecord(row: WorkflowRunStep): WorkflowRunStepRecord {
  return {
    ...row,
    inputObject: parseJsonObject(row.input),
    resultObject: parseJsonObject(row.result),
  };
}

function requirePersistedRow<T>(row: T | null | undefined, entity: string, operation: "insert" | "update" = "insert"): T {
  if (!row) {
    if (operation === "update") {
      throw new Error(`${entity} not found`);
    }
    throw new Error(`Failed to persist ${entity}`);
  }

  return row;
}

function normalizeWorkflowDefinitionInput(
  input: CreateWorkflowDefinitionInput,
): Omit<NewWorkflowDefinition, "id" | "createdAt" | "updatedAt"> {
  const name = input.name.trim();
  if (name.length === 0) {
    throw new Error("Workflow definition name is required");
  }

  if (!Array.isArray(input.steps)) {
    throw new Error("Workflow definition steps must be an array");
  }

  return {
    name,
    description: input.description?.trim() || null,
    version: input.version?.trim() || "1",
    status: input.status ?? "draft",
    projectId: input.projectId ?? null,
    triggerType: input.triggerType ?? "manual",
    triggerConfig: serializeJsonRecord(input.triggerConfig),
    steps: serializeWorkflowSteps(input.steps),
  };
}

export function createWorkflowDefinition(
  db: DB,
  input: CreateWorkflowDefinitionInput,
): WorkflowDefinitionRecord {
  const row = db
    .insert(workflowDefinitions)
    .values(normalizeWorkflowDefinitionInput(input))
    .returning()
    .get();

  return toWorkflowDefinitionRecord(requirePersistedRow(row, "workflow definition"));
}

export function getWorkflowDefinition(
  db: DB,
  id: string,
): WorkflowDefinitionRecord | null {
  const row = db
    .select()
    .from(workflowDefinitions)
    .where(eq(workflowDefinitions.id, id))
    .get();

  return row ? toWorkflowDefinitionRecord(row) : null;
}

export function listWorkflowDefinitions(
  db: DB,
  filters: ListWorkflowDefinitionFilters = {},
): WorkflowDefinitionRecord[] {
  const conditions: SQL[] = [];

  if (filters.status) {
    conditions.push(eq(workflowDefinitions.status, filters.status));
  }
  if (filters.projectId) {
    conditions.push(eq(workflowDefinitions.projectId, filters.projectId));
  }
  if (filters.triggerType) {
    conditions.push(eq(workflowDefinitions.triggerType, filters.triggerType));
  }

  const whereClause =
    conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : and(...conditions);
  const baseQuery = db.select().from(workflowDefinitions);
  const allRows = whereClause
    ? baseQuery.where(whereClause).orderBy(desc(workflowDefinitions.updatedAt)).all()
    : baseQuery.orderBy(desc(workflowDefinitions.updatedAt)).all();
  const rows = filters.limit && filters.limit > 0 ? allRows.slice(0, filters.limit) : allRows;
  return rows.map(toWorkflowDefinitionRecord);
}

export function startWorkflowRun(
  db: DB,
  input: StartWorkflowRunInput,
): WorkflowRunRecord {
  const row = db
    .insert(workflowRuns)
    .values({
      workflowId: input.workflowId,
      triggeredBy: input.triggeredBy,
      triggeredById: input.triggeredById ?? null,
      status: input.status ?? "running",
      startedAt: input.startedAt ?? new Date(),
      result: serializeJsonRecord(input.result),
      error: input.error ?? null,
      metadata: serializeJsonRecord(input.metadata),
    })
    .returning()
    .get();

  return toWorkflowRunRecord(requirePersistedRow(row, "workflow run"));
}

export function recordWorkflowRunStep(
  db: DB,
  input: RecordWorkflowRunStepInput,
): WorkflowRunStepRecord {
  const stepName = input.stepName.trim();
  if (stepName.length === 0) {
    throw new Error("Workflow run step name is required");
  }

  const row = db
    .insert(workflowRunSteps)
    .values({
      workflowRunId: input.workflowRunId,
      stepIndex: input.stepIndex,
      stepKey: input.stepKey?.trim() || `step-${input.stepIndex + 1}`,
      stepName,
      stepType: input.stepType,
      status: input.status ?? "pending",
      input: serializeJsonRecord(input.input),
      result: serializeJsonRecord(input.result),
      error: input.error ?? null,
      startedAt: input.startedAt ?? null,
      completedAt: input.completedAt ?? null,
    })
    .returning()
    .get();

  return toWorkflowRunStepRecord(requirePersistedRow(row, "workflow run step"));
}

export function finishWorkflowRun(
  db: DB,
  runId: string,
  input: FinishWorkflowRunInput = {},
): WorkflowRunRecord {
  const row = db
    .update(workflowRuns)
    .set({
      status: input.status ?? "completed",
      completedAt: input.completedAt ?? new Date(),
      result: input.result === undefined ? undefined : serializeJsonRecord(input.result),
      error: input.error === undefined ? undefined : input.error,
      metadata: input.metadata === undefined ? undefined : serializeJsonRecord(input.metadata),
    })
    .where(eq(workflowRuns.id, runId))
    .returning()
    .get();

  return toWorkflowRunRecord(requirePersistedRow(row, "workflow run", "update"));
}
