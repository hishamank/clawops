import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, events } from "@clawops/core";
import type { DB } from "@clawops/core";
import { createIdea, listIdeas, promoteIdeaToProject } from "@clawops/ideas";
import { IdeaStatus, Source, NotFoundError, ConflictError } from "@clawops/domain";

const ideaStatusEnum = z.nativeEnum(IdeaStatus);
const ideaSourceEnum = z.enum([Source.human, Source.agent]);

// ── Schemas ────────────────────────────────────────────────────────────────

const createIdeaBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  source: ideaSourceEnum.optional(),
});

const listIdeasQuery = z.object({
  status: ideaStatusEnum.optional(),
  tag: z.string().optional(),
});

const idParams = z.object({ id: z.string().min(1) });

// ── Helpers ────────────────────────────────────────────────────────────────

function writeEvent(
  dbHandle: DB,
  action: string,
  entityType: string,
  entityId: string,
  meta: Record<string, unknown>,
): void {
  dbHandle.insert(events)
    .values({
      action,
      entityType,
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
 * Fastify plugin that registers idea routes under `/ideas`.
 *
 * Routes:
 * - `POST /ideas` – create an idea (201)
 * - `GET  /ideas` – list ideas with optional status/tag filters
 * - `POST /ideas/:id/promote` – promote an idea to a project (404 / 409 on conflict)
 *
 * All mutations run inside a SQLite transaction and emit audit events.
 * The promote endpoint uses typed domain errors ({@link NotFoundError}, {@link ConflictError}).
 */
export async function ideaRoutes(app: FastifyInstance): Promise<void> {
  // POST /ideas
  app.post(
    "/ideas",
    {
      schema: {
        tags: ["ideas"],
        summary: "Create an idea",
        body: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            source: { type: "string", enum: ideaSourceEnum.options },
          },
          required: ["title"],
        },
        response: { 201: { type: "object", additionalProperties: true } },
      },
    },
    async (req, reply) => {
      const body = createIdeaBody.parse(req.body);
      const idea = inTransaction(() => {
        const i = createIdea(db, body);
        writeEvent(db, "idea.created", "idea", i.id, { title: i.title });
        return i;
      });
      return reply.status(201).send(idea);
    },
  );

  // GET /ideas
  app.get(
    "/ideas",
    {
      schema: {
        tags: ["ideas"],
        summary: "List ideas",
        querystring: {
          type: "object",
          properties: {
            status: { type: "string", enum: Object.values(IdeaStatus) },
            tag: { type: "string" },
          },
        },
        response: { 200: { type: "array", items: { type: "object", additionalProperties: true } } },
      },
    },
    async (req) => {
      const filters = listIdeasQuery.parse(req.query);
      return listIdeas(db, filters);
    },
  );

  // POST /ideas/:id/promote
  app.post(
    "/ideas/:id/promote",
    {
      schema: {
        tags: ["ideas"],
        summary: "Promote an idea to a project",
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
          409: {
            type: "object",
            properties: { error: { type: "string" }, code: { type: "string" } },
          },
        },
      },
    },
    async (req, reply) => {
      const { id } = idParams.parse(req.params);
      try {
        const result = inTransaction(() => {
          const r = promoteIdeaToProject(db, id);
          writeEvent(db, "idea.promoted", "idea", r.idea.id, {
            projectId: r.project.id,
          });
          writeEvent(db, "project.created", "project", r.project.id, {
            name: r.project.name,
            ideaId: r.idea.id,
          });
          return r;
        });
        return result;
      } catch (err) {
        if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message, code: err.code });
        if (err instanceof ConflictError) return reply.code(409).send({ error: err.message, code: err.code });
        throw err;
      }
    },
  );
}
