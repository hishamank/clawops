import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, events } from "@clawops/core";
import type { DB } from "@clawops/core";
import { createProject, getProject, listProjects, updateProject } from "@clawops/projects";
import { ProjectStatus } from "@clawops/domain";

const projectStatusEnum = z.nativeEnum(ProjectStatus);

// ── Schemas ────────────────────────────────────────────────────────────────

const createProjectBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: projectStatusEnum.optional(),
  prd: z.string().optional(),
  ideaId: z.string().optional(),
});

const updateProjectBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: projectStatusEnum.optional(),
  prd: z.string().optional(),
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
      entityType: "project",
      entityId,
      agentId,
      meta: JSON.stringify(meta),
    })
    .run();
}

// ── Plugin ─────────────────────────────────────────────────────────────────

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  // POST /projects
  app.post(
    "/projects",
    {
      schema: {
        tags: ["projects"],
        summary: "Create a project",
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: Object.values(ProjectStatus) },
            prd: { type: "string" },
            ideaId: { type: "string" },
          },
          required: ["name"],
        },
        response: { 201: { type: "object", additionalProperties: true } },
      },
    },
    async (req, reply) => {
      const body = createProjectBody.parse(req.body);
      const project = db.transaction(() => {
        const p = createProject(db, body);
        writeEvent(db, "project.created", p.id, { name: p.name }, req.agentId);
        return p;
      });
      return reply.status(201).send(project);
    },
  );

  // GET /projects
  app.get(
    "/projects",
    {
      schema: {
        tags: ["projects"],
        summary: "List projects",
        response: { 200: { type: "array", items: { type: "object", additionalProperties: true } } },
      },
    },
    async () => {
      return listProjects(db);
    },
  );

  // GET /projects/:id
  app.get(
    "/projects/:id",
    {
      schema: {
        tags: ["projects"],
        summary: "Get a project by ID (includes milestones and tasks)",
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
      const project = getProject(db, id);
      if (!project) {
        return reply.status(404).send({ error: "Not found" });
      }
      return project;
    },
  );

  // PATCH /projects/:id
  app.patch(
    "/projects/:id",
    {
      schema: {
        tags: ["projects"],
        summary: "Update a project",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: Object.values(ProjectStatus) },
            prd: { type: "string" },
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
      const body = updateProjectBody.parse(req.body);

      const existing = getProject(db, id);
      if (!existing) {
        return reply.status(404).send({ error: "Not found" });
      }

      const project = db.transaction(() => {
        const p = updateProject(db, id, body);
        writeEvent(db, "project.updated", p.id, { fields: Object.keys(body) }, req.agentId);
        return p;
      });
      return project;
    },
  );
}
