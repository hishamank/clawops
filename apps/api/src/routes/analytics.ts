import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "@clawops/core";
import {
  getTokenSummary,
  getCostsByAgent,
  getCostsByModel,
  getCostsByProject,
} from "@clawops/analytics";

// ── Schemas ────────────────────────────────────────────────────────────────

const tokenQuery = z.object({
  agentId: z.string().optional(),
  model: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const costQuery = z.object({
  groupBy: z.enum(["agent", "model", "project"]).optional(),
});

// ── Plugin ─────────────────────────────────────────────────────────────────

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  // GET /analytics/tokens
  app.get(
    "/analytics/tokens",
    {
      schema: {
        tags: ["analytics"],
        summary: "Get token usage summary",
        querystring: {
          type: "object",
          properties: {
            agentId: { type: "string" },
            model: { type: "string" },
            from: { type: "string", format: "date-time" },
            to: { type: "string", format: "date-time" },
          },
        },
        response: { 200: { type: "object", additionalProperties: true } },
      },
    },
    async (req) => {
      const filters = tokenQuery.parse(req.query);
      return getTokenSummary(db, {
        ...filters,
        from: filters.from ? new Date(filters.from) : undefined,
        to: filters.to ? new Date(filters.to) : undefined,
      });
    },
  );

  // GET /analytics/costs
  app.get(
    "/analytics/costs",
    {
      schema: {
        tags: ["analytics"],
        summary: "Get cost breakdown grouped by agent, model, or project",
        querystring: {
          type: "object",
          properties: {
            groupBy: { type: "string", enum: ["agent", "model", "project"] },
          },
        },
        response: { 200: { type: "array", items: { type: "object", additionalProperties: true } } },
      },
    },
    async (req) => {
      const { groupBy } = costQuery.parse(req.query);

      switch (groupBy) {
        case "model":
          return getCostsByModel(db);
        case "project":
          return getCostsByProject(db);
        case "agent":
        default:
          return getCostsByAgent(db);
      }
    },
  );
}
