/* eslint-disable no-console -- CLI tool uses console for output */
import type { DB, Task, Idea, Project, Milestone, AgentSession } from "@clawops/core";
import { events } from "@clawops/core";
import { db as coreDb } from "@clawops/core/db";
import { runMigrations } from "@clawops/core/migrate";
import { createTask, listTasks, updateTask, completeTask, getTaskSpec, setTaskSpec, appendTaskSpec } from "@clawops/tasks";
import { createIdea, listIdeas } from "@clawops/ideas";
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
  updates: { status: Task["status"]; priority?: Task["priority"] },
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

