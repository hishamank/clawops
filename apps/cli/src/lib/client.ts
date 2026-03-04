/* eslint-disable no-console -- CLI tool uses console for output */
import type { DB, Task, Idea, Project, Milestone } from "@clawops/core";
import { db as coreDb, runMigrations, events } from "@clawops/core";
import {
  createTask,
  listTasks,
  updateTask,
  completeTask,
} from "@clawops/tasks";
import { createIdea, listIdeas } from "@clawops/ideas";
import {
  createProject,
  getProject,
  listProjects,
} from "@clawops/projects";
import type { IdeaStatus } from "@clawops/domain";

// ── Mode detection ──────────────────────────────────────────────────────────

const rawMode = process.env["CLAWOPS_MODE"] ?? "remote";
if (rawMode !== "local" && rawMode !== "remote") {
  console.error(
    `Invalid CLAWOPS_MODE: "${rawMode}". Must be "local" or "remote".`,
  );
  process.exit(1);
}
const mode = rawMode as "local" | "remote";

export function isLocalMode(): boolean {
  return mode === "local";
}

function getDb(): DB {
  return coreDb;
}

function logReadEvent(
  db: DB,
  entityType: string,
  entityId: string,
): void {
  db.insert(events)
    .values({ action: "read", entityType, entityId })
    .run();
}

// ── Remote helpers ──────────────────────────────────────────────────────────

function getBaseUrl(): string {
  const url = process.env["CLAWOPS_API_URL"];
  if (mode === "remote") {
    if (!url) {
      console.error("CLAWOPS_API_URL is required in remote mode");
      process.exit(1);
    }
    return url;
  }
  return url ?? "http://localhost:3001";
}

const baseUrl = getBaseUrl();

function getApiKey(): string {
  const key = process.env["CLAWOPS_API_KEY"];
  if (!key) {
    console.error("CLAWOPS_API_KEY is required");
    process.exit(1);
  }
  return key;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": getApiKey(),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Network error: ${msg}`);
    process.exit(1);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const contentLength = res.headers.get("content-length");

  if (contentLength === "0" || res.status === 204) {
    if (!res.ok) {
      console.error(`API error ${res.status}: ${res.statusText}`);
      process.exit(1);
    }
    return undefined as unknown as T;
  }

  let json: unknown;
  try {
    if (contentType.includes("application/json")) {
      json = await res.json();
    } else {
      const text = await res.text();
      if (!res.ok) {
        console.error(`API error ${res.status}: ${text}`);
        process.exit(1);
      }
      return undefined as unknown as T;
    }
  } catch {
    console.error(`Failed to parse response (status ${res.status})`);
    process.exit(1);
  }

  if (!res.ok) {
    const msg =
      typeof (json as Record<string, unknown>)["error"] === "string"
        ? ((json as Record<string, unknown>)["error"] as string)
        : res.statusText;
    console.error(msg);
    process.exit(1);
  }

  return json as T;
}

// ── Ensure migrations in local mode ─────────────────────────────────────────

let migrated = false;
function ensureMigrated(): void {
  if (!migrated) {
    runMigrations();
    migrated = true;
  }
}

// ── Task operations ─────────────────────────────────────────────────────────

export async function taskCreate(input: {
  title: string;
  description?: string;
  priority?: Task["priority"];
  projectId?: string;
  assigneeId?: string;
}): Promise<Task> {
  if (mode === "local") {
    ensureMigrated();
    return createTask(getDb(), { ...input, source: "cli" });
  }
  return request<Task>("POST", "/tasks", input);
}

export async function taskList(filters?: {
  status?: Task["status"];
  assigneeId?: string;
  projectId?: string;
}): Promise<Task[]> {
  if (mode === "local") {
    ensureMigrated();
    const db = getDb();
    const result = listTasks(db, filters);
    for (const t of result) {
      logReadEvent(db, "task", t.id);
    }
    return result;
  }
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.assigneeId) params.set("assigneeId", filters.assigneeId);
  if (filters?.projectId) params.set("projectId", filters.projectId);
  const qs = params.toString();
  return request<Task[]>("GET", `/tasks${qs ? `?${qs}` : ""}`);
}

export async function taskUpdate(
  id: string,
  updates: { status: Task["status"]; priority?: Task["priority"] },
): Promise<Task> {
  if (mode === "local") {
    ensureMigrated();
    return updateTask(getDb(), id, updates);
  }
  return request<Task>("PATCH", `/tasks/${id}`, updates);
}

export async function taskDone(
  id: string,
  input: {
    summary: string;
    tokensIn?: number;
    artifacts?: Array<{ label: string; value: string }>;
  },
): Promise<Task> {
  if (mode === "local") {
    ensureMigrated();
    return completeTask(getDb(), id, input);
  }
  return request<Task>("POST", `/tasks/${id}/complete`, input);
}

// ── Idea operations ─────────────────────────────────────────────────────────

export async function ideaAdd(input: {
  title: string;
  description?: string;
  tags?: string[];
}): Promise<Idea> {
  if (mode === "local") {
    ensureMigrated();
    return createIdea(getDb(), { ...input, source: "human" });
  }
  return request<Idea>("POST", "/ideas", input);
}

export async function ideaList(filters?: {
  status?: IdeaStatus;
  tag?: string;
}): Promise<Idea[]> {
  if (mode === "local") {
    ensureMigrated();
    const db = getDb();
    const result = listIdeas(db, filters);
    for (const i of result) {
      logReadEvent(db, "idea", i.id);
    }
    return result;
  }
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.tag) params.set("tag", filters.tag);
  const qs = params.toString();
  return request<Idea[]>("GET", `/ideas${qs ? `?${qs}` : ""}`);
}

// ── Project operations ──────────────────────────────────────────────────────

export async function projectCreate(input: {
  name: string;
  status?: Project["status"];
}): Promise<Project> {
  if (mode === "local") {
    ensureMigrated();
    return createProject(getDb(), input);
  }
  return request<Project>("POST", "/projects", input);
}

export async function projectList(): Promise<Project[]> {
  if (mode === "local") {
    ensureMigrated();
    const db = getDb();
    const result = listProjects(db);
    for (const p of result) {
      logReadEvent(db, "project", p.id);
    }
    return result;
  }
  return request<Project[]>("GET", "/projects");
}

export async function projectInfo(
  id: string,
): Promise<Project & { milestones: Milestone[]; taskCount: number }> {
  if (mode === "local") {
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
  return request<Project & { milestones: Milestone[]; taskCount: number }>(
    "GET",
    `/projects/${id}`,
  );
}

export function getAgentId(): string {
  const id = process.env["CLAWOPS_AGENT_ID"];
  if (!id) {
    console.error("CLAWOPS_AGENT_ID is required");
    process.exit(1);
  }
  return id;
}

export const api = {
  get: (path: string): Promise<unknown> => request("GET", path),
  post: (path: string, body?: unknown): Promise<unknown> =>
    request("POST", path, body),
  patch: (path: string, body?: unknown): Promise<unknown> =>
    request("PATCH", path, body),
};
