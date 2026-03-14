/* eslint-disable no-console -- CLI tool uses console for output */
import type {
  DB,
  Task,
  Idea,
  Project,
  Milestone,
  AgentSession,
  TaskRelation,
} from "@clawops/core";
import { events } from "@clawops/core";
import { db as coreDb } from "@clawops/core/db";
import { runMigrations } from "@clawops/core/migrate";
import { createTask, listTasks, updateTask, completeTask, getTaskSpec, setTaskSpec, appendTaskSpec, createTaskRelation, deleteTaskRelation, listTaskRelations, type CreateTaskRelationInput, type TaskRelationWithTask } from "@clawops/tasks";
import {
  createWorkflowDefinition,
  getWorkflowDefinition,
  listWorkflowDefinitions,
  updateWorkflowDefinition,
  createWorkflowRun,
  listWorkflowRuns,
  getWorkflowRun,
  type WorkflowRecord,
  type WorkflowRunRecord,
  type WorkflowRunWithSteps,
  type CreateWorkflowInput,
  type UpdateWorkflowInput,
  type ListWorkflowsFilters,
  type WorkflowStepDefinition,
} from "@clawops/workflows";
import { createIdea, listIdeas, getIdeaSections, getIdeaSection, updateIdeaSection, updateIdeaSections, getIdeaDraftPrd, setIdeaDraftPrd, type IdeaSectionKey, type IdeaSections } from "@clawops/ideas";
import {
  createProject,
  getProject,
  listProjects,
  getProjectContext,
  activateProject,
  deactivateProject,
  getActiveSession,
  getProjectSpec,
  setProjectSpec,
  appendProjectSpec,
  type ProjectContext,
} from "@clawops/projects";
import type { OpenClawSessionRecord, OpenClawSessionStatus } from "@clawops/sync";
import { listOpenClawSessions } from "@clawops/sync";
import type { IdeaStatus } from "@clawops/domain";
import * as fs from "node:fs";

export function isLocalMode(): boolean {
  return true;
}

function getDb(): DB {
  return coreDb;
}

function logReadEvent(db: DB, entityType: string, entityId: string): void {
  db.insert(events)
    .values({ action: "read", entityType, entityId })
    .run();
}

let migrated = false;
export function ensureMigrated(): void {
  if (!migrated) {
    runMigrations();
    migrated = true;
  }
}

export async function taskCreate(input: {
  title: string;
  description?: string;
  priority?: Task["priority"];
  projectId?: string;
  assigneeId?: string;
  specContent?: string;
  templateId?: string;
  stageId?: string;
  properties?: Record<string, unknown>;
  ideaId?: string;
}): Promise<Task> {
  ensureMigrated();
  return createTask(getDb(), { ...input, source: "cli" });
}

export async function taskList(filters?: {
  status?: Task["status"];
  assigneeId?: string;
  projectId?: string;
  withSpecs?: boolean;
}): Promise<Task[]> {
  ensureMigrated();
  const db = getDb();
  const result = listTasks(db, filters);
  for (const t of result) {
    logReadEvent(db, "task", t.id);
  }
  return result;
}

export async function taskUpdate(
  id: string,
  updates: {
    status: Task["status"];
    priority?: Task["priority"];
    templateId?: string;
    stageId?: string;
    properties?: Record<string, unknown> | null;
    ideaId?: string;
  },
): Promise<Task> {
  ensureMigrated();
  return updateTask(getDb(), id, updates);
}

export async function taskDone(
  id: string,
  input: {
    summary: string;
    tokensIn?: number;
    artifacts?: Array<{ label: string; value: string }>;
  },
): Promise<Task> {
  ensureMigrated();
  return completeTask(getDb(), id, input);
}

export async function ideaAdd(input: {
  title: string;
  description?: string;
  tags?: string[];
}): Promise<Idea> {
  ensureMigrated();
  return createIdea(getDb(), { ...input, source: "human" });
}

export async function ideaList(filters?: {
  status?: IdeaStatus;
  tag?: string;
}): Promise<Idea[]> {
  ensureMigrated();
  const db = getDb();
  const result = listIdeas(db, filters);
  for (const i of result) {
    logReadEvent(db, "idea", i.id);
  }
  return result;
}

export async function ideaGetSections(id: string): Promise<IdeaSections> {
  ensureMigrated();
  const db = getDb();
  const result = getIdeaSections(db, id);
  logReadEvent(db, "idea", id);
  return result;
}

export async function ideaGetSection(id: string, section: IdeaSectionKey): Promise<string | null> {
  ensureMigrated();
  const db = getDb();
  const result = getIdeaSection(db, id, section);
  logReadEvent(db, "idea", id);
  return result;
}

export async function ideaUpdateSection(
  id: string,
  section: IdeaSectionKey,
  content: string,
): Promise<Idea> {
  ensureMigrated();
  const db = getDb();
  return updateIdeaSection(db, id, section, content);
}

export async function ideaUpdateSections(
  id: string,
  sections: Partial<IdeaSections>,
): Promise<Idea> {
  ensureMigrated();
  const db = getDb();
  return updateIdeaSections(db, id, sections);
}

export async function ideaGetDraftPrd(id: string): Promise<string | null> {
  ensureMigrated();
  const db = getDb();
  const result = getIdeaDraftPrd(db, id);
  logReadEvent(db, "idea", id);
  return result;
}

export async function ideaSetDraftPrd(id: string, content: string): Promise<Idea> {
  ensureMigrated();
  const db = getDb();
  return setIdeaDraftPrd(db, id, content);
}

export async function projectCreate(input: {
  name: string;
  status?: Project["status"];
}): Promise<Project> {
  ensureMigrated();
  return createProject(getDb(), input);
}

export async function projectList(): Promise<Project[]> {
  ensureMigrated();
  const db = getDb();
  const result = listProjects(db);
  for (const p of result) {
    logReadEvent(db, "project", p.id);
  }
  return result;
}

export async function projectInfo(
  id: string,
): Promise<Project & { milestones: Milestone[]; taskCount: number }> {
  ensureMigrated();
  const db = getDb();
  const result = getProject(db, id);
  if (!result) {
    console.error(`Project not found: ${id}`);
    process.exit(1);
  }
  logReadEvent(db, "project", id);
  return result;
}

export function getAgentId(): string {
  const id = process.env["CLAWOPS_AGENT_ID"];
  if (!id) {
    console.error("CLAWOPS_AGENT_ID is required");
    process.exit(1);
  }
  return id;
}

export async function projectContext(
  projectId: string,
  options?: { minimal?: boolean },
): Promise<ProjectContext> {
  ensureMigrated();
  const db = getDb();
  const result = getProjectContext(db, projectId, options);
  if (!result) {
    console.error(`Project not found: ${projectId}`);
    process.exit(1);
  }
  logReadEvent(db, "project", projectId);
  return result;
}

export async function projectActivate(projectId: string): Promise<AgentSession> {
  ensureMigrated();
  const agentId = getAgentId();
  const db = getDb();
  return activateProject(db, agentId, projectId);
}

export async function projectDeactivate(summary: string): Promise<AgentSession> {
  ensureMigrated();
  const agentId = getAgentId();
  const db = getDb();
  const result = deactivateProject(db, agentId, summary);
  if (!result) {
    console.error("No active session found");
    process.exit(1);
  }
  return result;
}

export async function getActiveProjectSession(): Promise<AgentSession | null> {
  ensureMigrated();
  const agentId = getAgentId();
  const db = getDb();
  return getActiveSession(db, agentId);
}

export async function projectSpecGet(projectId: string): Promise<string | null> {
  ensureMigrated();
  const db = getDb();
  const result = getProjectSpec(db, projectId);
  logReadEvent(db, "project", projectId);
  return result;
}

export async function projectSpecSet(projectId: string, specContent: string): Promise<Project> {
  ensureMigrated();
  const db = getDb();
  return setProjectSpec(db, projectId, specContent);
}

export async function projectSpecAppend(projectId: string, content: string): Promise<Project> {
  ensureMigrated();
  const db = getDb();
  return appendProjectSpec(db, projectId, content);
}

export async function openClawSessionList(filters?: {
  connectionId?: string;
  status?: OpenClawSessionStatus;
  limit?: number;
}): Promise<OpenClawSessionRecord[]> {
  ensureMigrated();
  return listOpenClawSessions(getDb(), filters);
}

// ── Task Spec Functions ─────────────────────────────────────────────────────

export async function taskSpec(id: string): Promise<string | null> {
  ensureMigrated();
  return getTaskSpec(getDb(), id);
}

export async function taskSpecSet(id: string, content: string): Promise<Task> {
  ensureMigrated();
  return setTaskSpec(getDb(), id, content);
}

export async function taskSpecSetFile(id: string, filePath: string): Promise<Task> {
  ensureMigrated();
  const content = fs.readFileSync(filePath, "utf-8");
  return setTaskSpec(getDb(), id, content);
}

export async function taskSpecAppend(id: string, content: string): Promise<Task> {
  ensureMigrated();
  return appendTaskSpec(getDb(), id, content);
}

// ── Task Relation Functions ─────────────────────────────────────────────────

export async function taskRelationsList(taskId: string): Promise<TaskRelationWithTask[]> {
  ensureMigrated();
  return listTaskRelations(getDb(), taskId);
}

export async function taskRelationCreate(
  _taskId: string,
  input: CreateTaskRelationInput,
): Promise<TaskRelation> {
  ensureMigrated();
  return createTaskRelation(getDb(), input);
}

export async function taskRelationDelete(
  _taskId: string,
  relationId: string,
): Promise<void> {
  ensureMigrated();
  deleteTaskRelation(getDb(), relationId);
}

// ── Workflow Functions ─────────────────────────────────────────────────────

export async function workflowCreate(input: CreateWorkflowInput): Promise<WorkflowRecord> {
  ensureMigrated();
  return createWorkflowDefinition(getDb(), input);
}

export async function workflowGet(id: string): Promise<WorkflowRecord | null> {
  ensureMigrated();
  const db = getDb();
  const result = getWorkflowDefinition(db, id);
  if (result) {
    logReadEvent(db, "workflow", id);
  }
  return result;
}

export async function workflowList(filters?: ListWorkflowsFilters): Promise<WorkflowRecord[]> {
  ensureMigrated();
  const db = getDb();
  const result = listWorkflowDefinitions(db, filters);
  for (const w of result) {
    logReadEvent(db, "workflow", w.id);
  }
  return result;
}

export async function workflowUpdate(id: string, input: UpdateWorkflowInput): Promise<WorkflowRecord> {
  ensureMigrated();
  return updateWorkflowDefinition(getDb(), id, input);
}

export async function workflowRunCreate(input: {
  workflowId: string;
  triggeredBy: "human" | "agent" | "schedule" | "event";
  triggeredById?: string;
}): Promise<WorkflowRunRecord> {
  ensureMigrated();
  return createWorkflowRun(getDb(), { ...input, status: "pending" });
}

export async function workflowRunList(workflowId: string): Promise<WorkflowRunRecord[]> {
  ensureMigrated();
  const db = getDb();
  const result = listWorkflowRuns(db, workflowId);
  for (const r of result) {
    logReadEvent(db, "workflow_run", r.id);
  }
  return result;
}

export async function workflowRunGet(id: string): Promise<WorkflowRunWithSteps | null> {
  ensureMigrated();
  const db = getDb();
  const result = getWorkflowRun(db, id);
  if (result) {
    logReadEvent(db, "workflow_run", id);
  }
  return result;
}

export type { WorkflowStepDefinition };
