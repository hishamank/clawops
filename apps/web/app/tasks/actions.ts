"use server";

import { z } from "zod";
import { createTask, addTaskResourceLink, updateTask, deleteTask } from "@clawops/tasks";
import { events, createActivityEvent } from "@clawops/core";
import { getDb } from "@/lib/server/runtime";
import { TaskStatus, type TaskPriority } from "@clawops/domain";

const taskIdSchema = z.string().min(1);

export interface CreateTaskInput {
  title: string;
  description?: string;
  projectId?: string;
  priority?: TaskPriority;
  complexity?: number;
  issueUrl?: string;
}

export interface CreateTaskResult {
  id?: string;
  error?: string;
}

export async function createTaskAction(
  input: CreateTaskInput
): Promise<CreateTaskResult> {
  try {
    if (!input.title?.trim()) {
      return { error: "Title is required" };
    }

    if (input.issueUrl) {
      try {
        const url = new URL(input.issueUrl);
        if (!["http:", "https:"].includes(url.protocol)) {
          return { error: "Issue URL must use http or https protocol" };
        }
      } catch {
        return { error: "Invalid issue URL" };
      }
    }

    const db = getDb();
    const task = db.transaction((tx) => {
      const t = createTask(tx, {
        title: input.title.trim(),
        description: input.description?.trim() || undefined,
        projectId: input.projectId || undefined,
        priority: input.priority,
        properties: input.complexity != null
          ? { complexity: input.complexity }
          : undefined,
        source: "human",
      });

      tx.insert(events)
        .values({
          action: "task.created",
          entityType: "task",
          entityId: t.id,
          agentId: null,
          meta: JSON.stringify({ title: t.title }),
        })
        .run();

      createActivityEvent(tx, {
        source: "user",
        type: "task.created",
        title: `Task created: ${t.title}`,
        entityType: "task",
        entityId: t.id,
        projectId: t.projectId ?? undefined,
        taskId: t.id,
        metadata: JSON.stringify({
          title: t.title,
          status: t.status,
          priority: t.priority,
          source: "human",
        }),
      });

      return t;
    });

    if (input.issueUrl) {
      addTaskResourceLink(db, task.id, {
        provider: "issue",
        resourceType: "url",
        url: input.issueUrl,
        label: "Issue",
      });
    }

    return { id: task.id };
  } catch {
    return { error: "Failed to create task" };
  }
}

export interface MarkDoneResult {
  id?: string;
  error?: string;
}

export async function markTaskDoneAction(taskId: string): Promise<MarkDoneResult> {
  const parsed = taskIdSchema.safeParse(taskId);
  if (!parsed.success) return { error: "Invalid task ID" };
  try {
    const db = getDb();
    let found = false;
    db.transaction((tx) => {
      const task = updateTask(tx, taskId, { status: "done", completedAt: new Date() });
      if (!task) return;
      found = true;
      tx.insert(events)
        .values({
          action: "task.done",
          entityType: "task",
          entityId: task.id,
          agentId: null,
          meta: null,
        })
        .run();
      createActivityEvent(tx, {
        source: "user",
        type: "task.done",
        title: `Task marked done: ${task.title}`,
        entityType: "task",
        entityId: task.id,
        projectId: task.projectId ?? undefined,
        taskId: task.id,
        metadata: JSON.stringify({ status: "done" }),
      });
    });
    if (!found) return { error: "Task not found" };
    return { id: taskId };
  } catch {
    return { error: "Failed to mark task as done" };
  }
}

export interface DeleteTaskResult {
  id?: string;
  error?: string;
}

export async function deleteTaskAction(taskId: string): Promise<DeleteTaskResult> {
  const parsed = taskIdSchema.safeParse(taskId);
  if (!parsed.success) return { error: "Invalid task ID" };
  try {
    const db = getDb();
    let deleted = false;
    db.transaction((tx) => {
      const result = deleteTask(tx, taskId);
      if (!result) return;
      deleted = true;
      tx.insert(events)
        .values({
          action: "task.deleted",
          entityType: "task",
          entityId: taskId,
          agentId: null,
          meta: null,
        })
        .run();
      createActivityEvent(tx, {
        source: "user",
        type: "task.deleted",
        title: "Task deleted",
        entityType: "task",
        entityId: taskId,
      });
    });
    if (!deleted) return { error: "Task not found" };
    return { id: taskId };
  } catch {
    return { error: "Failed to delete task" };
  }
}

export interface UpdateStatusResult {
  id?: string;
  error?: string;
}

const taskStatusSchema = z.nativeEnum(TaskStatus);

export async function updateTaskStatusAction(
  taskId: string,
  newStatus: TaskStatus,
): Promise<UpdateStatusResult> {
  const idParsed = taskIdSchema.safeParse(taskId);
  if (!idParsed.success) return { error: "Invalid task ID" };
  const statusParsed = taskStatusSchema.safeParse(newStatus);
  if (!statusParsed.success) return { error: "Invalid status" };
  const status = statusParsed.data;
  try {
    const db = getDb();
    let found = false;
    db.transaction((tx) => {
      const task = updateTask(tx, taskId, {
        status,
        completedAt: status === "done" ? new Date() : null,
      });
      if (!task) return;
      found = true;
      tx.insert(events)
        .values({
          action: "task.status-changed",
          entityType: "task",
          entityId: task.id,
          agentId: null,
          meta: JSON.stringify({ status }),
        })
        .run();
      createActivityEvent(tx, {
        source: "user",
        type: "task.status-changed",
        title: `Task status changed to ${status}: ${task.title}`,
        entityType: "task",
        entityId: task.id,
        projectId: task.projectId ?? undefined,
        taskId: task.id,
        metadata: JSON.stringify({ status }),
      });
    });
    if (!found) return { error: "Task not found" };
    return { id: taskId };
  } catch {
    return { error: "Failed to update task status" };
  }
}
