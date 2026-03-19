"use server";

import { createTask, addTaskResourceLink, updateTask, deleteTask } from "@clawops/tasks";
import { events, createActivityEvent } from "@clawops/core";
import { getDb } from "@/lib/server/runtime";
import type { TaskPriority } from "@clawops/domain";

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
  try {
    const db = getDb();
    db.transaction((tx) => {
      const task = updateTask(tx, taskId, { status: "done" });
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
  try {
    const db = getDb();
    db.transaction((tx) => {
      deleteTask(tx, taskId);
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
    return { id: taskId };
  } catch {
    return { error: "Failed to delete task" };
  }
}
