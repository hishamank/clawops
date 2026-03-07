/* eslint-disable no-console -- CLI tool uses console for output */
import type { DB, Task, Idea, Project, Milestone } from "@clawops/core";
import { events } from "@clawops/core";
import { db as coreDb } from "@clawops/core/db";
import { runMigrations } from "@clawops/core/migrate";
import { createTask, listTasks, updateTask, completeTask } from "@clawops/tasks";
import { createIdea, listIdeas } from "@clawops/ideas";
import { createProject, getProject, listProjects } from "@clawops/projects";
import type { IdeaStatus } from "@clawops/domain";

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
}): Promise<Task> {
  ensureMigrated();
  return createTask(getDb(), { ...input, source: "cli" });
}

export async function taskList(filters?: {
  status?: Task["status"];
  assigneeId?: string;
  projectId?: string;
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
