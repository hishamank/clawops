import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, events } from "@clawops/core";
import type { DB } from "@clawops/core";
import { listNotifications, markRead, markAllRead } from "@clawops/notifications";

// ── Schemas ────────────────────────────────────────────────────────────────

const listQuery = z.object({
  read: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

const idParams = z.object({ id: z.string().min(1) });

// ── Helpers ────────────────────────────────────────────────────────────────

function writeEvent(
  dbHandle: DB,
  action: string,
  entityId: string,
  meta: Record<string, unknown>,
  agentId?: string,
): void {
  dbHandle.insert(events)
    .values({
      action,
      entityType: "notification",
      entityId,
      agentId,
      meta: JSON.stringify(meta),
    })
    .run();
}

// ── Plugin ─────────────────────────────────────────────────────────────────

/**
 * Fastify plugin that registers notification routes.
 *
 * Routes:
 * - `GET   /notifications` — List notifications, optionally filtered by read status.
 * - `PATCH /notifications/:id/read` — Mark a single notification as read.
 * - `PATCH /notifications/read-all` — Mark all notifications as read.
 *
 * All mutating endpoints write audit events decorated with `req.agentId`.
 *
 * @param app - The Fastify instance to register routes on.
 */
export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  // GET /notifications
  app.get(
    "/notifications",
    {
      schema: {
        tags: ["notifications"],
        summary: "List notifications",
        querystring: {
          type: "object",
          properties: {
            read: { type: "string", enum: ["true", "false"] },
          },
        },
        response: { 200: { type: "array", items: { type: "object", additionalProperties: true } } },
      },
    },
    async (req) => {
      const { read } = listQuery.parse(req.query);
      return listNotifications(db, read !== undefined ? { read } : undefined);
    },
  );

  // PATCH /notifications/:id/read
  app.patch(
    "/notifications/:id/read",
    {
      schema: {
        tags: ["notifications"],
        summary: "Mark a notification as read",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
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
      const notification = db.transaction(() => {
        const n = markRead(db, id);
        if (!n) return null;
        writeEvent(db, "notification.read", n.id, {}, req.agentId);
        return n;
      });
      if (!notification) {
        return reply.status(404).send({ error: "Not found" });
      }
      return notification;
    },
  );

  // PATCH /notifications/read-all
  app.patch(
    "/notifications/read-all",
    {
      schema: {
        tags: ["notifications"],
        summary: "Mark all notifications as read",
        response: {
          200: {
            type: "object",
            properties: { success: { type: "boolean" } },
          },
        },
      },
    },
    async (req) => {
      db.transaction(() => {
        markAllRead(db);
        writeEvent(db, "notification.read-all", "all", {}, req.agentId);
      });
      return { success: true };
    },
  );
}
