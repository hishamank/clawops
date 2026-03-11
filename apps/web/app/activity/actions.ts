"use server";

import { z } from "zod";
import {
  activityEvents,
  and,
  buildActivityEventQueryConditions,
  desc,
  type ActivityEventFilters,
} from "@clawops/core";
import { getDb } from "@/lib/server/runtime";
import type { ActivityEvent } from "@/lib/types";

const activityFiltersSchema = z.object({
  type: z.string().optional(),
  agentId: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  severity: z.enum(["info", "warning", "error", "critical"]).optional(),
  source: z.enum(["system", "agent", "user", "sync", "workflow", "hook"]).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

export type ActivityFiltersInput = z.infer<typeof activityFiltersSchema>;

function serializeActivityEvent(
  event: typeof activityEvents.$inferSelect,
): ActivityEvent {
  const createdAt =
    event.createdAt instanceof Date
      ? event.createdAt.toISOString()
      : new Date(event.createdAt).toISOString();

  return {
    ...event,
    createdAt,
  };
}

export async function listActivityEvents(
  input: ActivityFiltersInput = {},
): Promise<ActivityEvent[]> {
  const filters = activityFiltersSchema.parse(input);
  const conditions = buildActivityEventQueryConditions(filters as ActivityEventFilters);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const queryLimit = Math.min(filters.limit ?? 50, 200);
  const queryOffset = filters.offset ?? 0;

  const events = getDb()
    .select()
    .from(activityEvents)
    .where(whereClause)
    .orderBy(desc(activityEvents.createdAt))
    .limit(queryLimit)
    .offset(queryOffset)
    .all();

  return events.map(serializeActivityEvent);
}
