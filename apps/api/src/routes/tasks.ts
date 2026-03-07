import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { events } from "@clawops/core";
import type { DB } from "@clawops/core";
import { db } from "@clawops/core/db";
import { createTask, getTask, listTasks, updateTask, completeTask } from "@clawops/tasks";
import { createNotification } from "@clawops/notifications";
import { TaskStatus, TaskPriority, Source } from "@clawops/domain";

const taskStatusEnum = z.nativeEnum(TaskStatus);
const taskPriorityEnum = z.nativeEnum(TaskPriority);
const taskSourceEnum = z.nativeEnum(Source);

// ── Schemas ────────────────────────────────────────────────────────────────

const createTaskBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  assigneeId: z.string().optional(),
  projectId: z.string().optional(),
  source: taskSourceEnum.optional(),
  dueDate: z.string().datetime().optional(),
});

const listTasksQuery = z.object({
  status: taskStatusEnum.optional(),
  assigneeId: z.string().optional(),
  projectId: z.string().optional(),
  priority: taskPriorityEnum.optional(),
});

const updateTaskBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  assigneeId: z.string().optional(),
  projectId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});

const completeTaskBody = z.object({
  summary: z.string().min(1),
  tokensIn: z.number().int().nonnegative().optional(),
  tokensOut: z.number().int().nonnegative().optional(),
  model: z.string().optional(),
  artifacts: z
    .array(z.object({ label: z.string().min(1), value: z.string().min(1) }))
    .optional(),
});

const idParams = z.object({ id: z.string().min(1) });

// ── Helpers ────────────────────────────────────────────────────────────────

function writeEvent(
  dbHandle: DB,
  action: string,
  entityId: string,
  meta: Record<string, unknown>,
): void {
  dbHandle.insert(events)
    .values({
      action,
      entityType: "task",
      entityId,
      meta: JSON.stringify(meta),
    })
    .run();
}

function inTransaction<T>(fn: () => T): T {
  return db.$client.transaction(fn)();
}

// ── Plugin ─────────────────────────────────────────────────────────────────

/**
 * Fastify plugin that registers task CRUD routes under `/tasks`.
 *
 * Routes:
 * - `POST /tasks` – create a task (201)
 * - `GET  /tasks` – list tasks with optional filters
 * - `GET  /tasks/:id` – get a single task (404 if missing)
 * - `PATCH /tasks/:id` – update a task (404 if missing)
 * - `POST /tasks/:id/complete` – mark a task complete and emit a notification (404 if missing)
 *
 * All mutations run inside a SQLite transaction and emit an audit event.
 */
export async function taskRoutes(app: FastifyInstance): Promise<void> {
  // POST /tasks
  app.post(
    "/tasks",
    {
      schema: {
        tags: ["tasks"],
        summary: "Create a task",
        body: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: Object.values(TaskStatus) },
            priority: { type: "string", enum: Object.values(TaskPriority) },
            assigneeId: { type: "string" },
            projectId: { type: "string" },
            source: { type: "string", enum: Object.values(Source) },
            dueDate: { type: "string", format: "date-time" },
          },
          required: ["title"],
        },
        response: { 201: { type: "object", additionalProperties: true } },
      },
    },
    async (req, reply) => {
      const body = createTaskBody.parse(req.body);
      const task = inTransaction(() => {
        const t = createTask(db, {
          ...body,
          dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        });
        writeEvent(db, "task.created", t.id, { title: t.title });
        return t;
      });
      return reply.status(201).send(task);
    },
  );

  // GET /tasks
  app.get(
    "/tasks",
    {
      schema: {
        tags: ["tasks"],
        summary: "List tasks",
        querystring: {
          type: "object",
          properties: {
            status: { type: "string", enum: Object.values(TaskStatus) },
            assigneeId: { type: "string" },
            projectId: { type: "string" },
            priority: { type: "string", enum: Object.values(TaskPriority) },
          },
        },
        response: { 200: { type: "array", items: { type: "object", additionalProperties: true } } },
      },
    },
    async (req) => {
      const filters = listTasksQuery.parse(req.query);
      return listTasks(db, filters);
    },
  );

  // GET /tasks/:id
  app.get(
    "/tasks/:id",
    {
      schema: {
        tags: ["tasks"],
        summary: "Get a task by ID (includes artifacts)",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        response: {
          200: { type: "object", additionalProperties: true },
          404: {
            type: "object",
            properties: { error: { type: "string" }, code: { type: "string" } },
          },
        },
      },
    },
    async (req, reply) => {
      const { id } = idParams.parse(req.params);
      const task = getTask(db, id);
      if (!task) {
        return reply.status(404).send({ error: "Task not found", code: "TASK_NOT_FOUND" });
      }
      return task;
    },
  );

  // PATCH /tasks/:id
  app.patch(
    "/tasks/:id",
    {
      schema: {
        tags: ["tasks"],
        summary: "Update a task",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: Object.values(TaskStatus) },
            priority: { type: "string", enum: Object.values(TaskPriority) },
            assigneeId: { type: "string" },
            projectId: { type: "string" },
            dueDate: { type: "string", format: "date-time" },
          },
        },
        response: {
          200: { type: "object", additionalProperties: true },
          404: {
            type: "object",
            properties: { error: { type: "string" } },
          },
        },
      },
    },
    async (req, reply) => {
      const { id } = idParams.parse(req.params);
      const body = updateTaskBody.parse(req.body);
      const task = inTransaction(() => {
        const t = updateTask(db, id, {
          ...body,
          dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        });
        if (!t) return null;
        writeEvent(db, "task.updated", t.id, { fields: Object.keys(body) });
        return t;
      });
      if (!task) return reply.code(404).send({ error: "Task not found" });
      return task;
    },
  );

  // POST /tasks/:id/complete
  app.post(
    "/tasks/:id/complete",
    {
      schema: {
        tags: ["tasks"],
        summary: "Mark a task as complete",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            summary: { type: "string" },
            tokensIn: { type: "integer" },
            tokensOut: { type: "integer" },
            model: { type: "string" },
            artifacts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  value: { type: "string" },
                },
                required: ["label", "value"],
              },
            },
          },
          required: ["summary"],
        },
        response: {
          200: { type: "object", additionalProperties: true },
          404: {
            type: "object",
            properties: { error: { type: "string" } },
          },
        },
      },
    },
    async (req, reply) => {
      const { id } = idParams.parse(req.params);
      const body = completeTaskBody.parse(req.body);
      const task = inTransaction(() => {
        const t = completeTask(db, id, body);
        if (!t) return null;

        createNotification(db, {
          type: "task.completed",
          title: "Task completed",
          body: `Task "${t.title}" has been completed.`,
          entityType: "task",
          entityId: t.id,
        });

        writeEvent(db, "task.completed", t.id, { summary: body.summary });
        return t;
      });
      if (!task) return reply.code(404).send({ error: "Task not found" });
      return task;
    },
  );
}
