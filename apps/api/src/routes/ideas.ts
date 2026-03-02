import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, events } from "@clawops/core";
import { createIdea, listIdeas, promoteIdeaToProject } from "@clawops/ideas";

const ideaStatusEnum = z.enum(["raw", "reviewed", "promoted", "archived"]);
const ideaSourceEnum = z.enum(["human", "agent"]);

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
  action: string,
  entityType: string,
  entityId: string,
  meta: Record<string, unknown>,
): void {
  db.insert(events)
    .values({
      action,
      entityType,
      entityId,
      meta: JSON.stringify(meta),
    })
    .run();
}

// ── Plugin ─────────────────────────────────────────────────────────────────

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
      const idea = createIdea(db, body);
      writeEvent("idea.created", "idea", idea.id, { title: idea.title });
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
            status: { type: "string", enum: ideaStatusEnum.options },
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
        const result = promoteIdeaToProject(db, id);
        writeEvent("idea.promoted", "idea", result.idea.id, {
          projectId: result.project.id,
        });
        writeEvent("project.created", "project", result.project.id, {
          name: result.project.name,
          ideaId: result.idea.id,
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (message.includes("not found")) {
          return reply.status(404).send({ error: message, code: "IDEA_NOT_FOUND" });
        }
        if (message.includes("already promoted")) {
          return reply.status(409).send({ error: message, code: "IDEA_ALREADY_PROMOTED" });
        }
        throw err;
      }
    },
  );
}
