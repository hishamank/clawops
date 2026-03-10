import { eq, type SQL } from "drizzle-orm";
import {
  activityEvents,
  type ActivityEvent,
  type ActivityEventSeverity,
  type ActivityEventSource,
  type NewActivityEvent,
} from "./schema.js";

export function parseJsonArray(val: string | null): string[] {
  if (!val) return [];
  try {
    const parsed: unknown = JSON.parse(val);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
    return [];
  } catch {
    return [];
  }
}

export function toJsonArray(arr: string[]): string {
  return JSON.stringify(arr);
}

export function parseJsonObject(val: string | null): Record<string, unknown> {
  if (!val) return {};
  try {
    const parsed: unknown = JSON.parse(val);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

export function toJsonObject(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

// ── Activity Event Helpers ─────────────────────────────────────────────────

export interface ActivityEventFilters {
  type?: string;
  agentId?: string;
  entityType?: string;
  entityId?: string;
  projectId?: string;
  taskId?: string;
  severity?: ActivityEventSeverity;
  source?: ActivityEventSource;
  limit?: number;
  offset?: number;
}

/**
 * Normalizes an activity event input for insertion.
 * Re-serializes metadata via parseJsonObject to safely handle malformed JSON input.
 *
 * Note: this is a data-normalizer, NOT a DB insert. Call it before inserting:
 *   `db.insert(activityEvents).values(normalizeActivityEvent(input)).run()`
 */
export function normalizeActivityEvent(
  event: Omit<NewActivityEvent, "id" | "createdAt">,
): NewActivityEvent {
  return {
    ...event,
    metadata: event.metadata ? toJsonObject(parseJsonObject(event.metadata)) : null,
  };
}

/**
 * @deprecated Renamed to normalizeActivityEvent for clarity.
 * Will be removed in a follow-up — update callers to use normalizeActivityEvent.
 */
export const createActivityEvent = normalizeActivityEvent;

export function buildActivityEventQueryConditions(
  filters: ActivityEventFilters,
): SQL[] {
  const conditions: SQL[] = [];

  if (filters.type) {
    conditions.push(eq(activityEvents.type, filters.type));
  }
  if (filters.agentId) {
    conditions.push(eq(activityEvents.agentId, filters.agentId));
  }
  if (filters.entityType) {
    conditions.push(eq(activityEvents.entityType, filters.entityType));
  }
  if (filters.entityId) {
    conditions.push(eq(activityEvents.entityId, filters.entityId));
  }
  if (filters.projectId) {
    conditions.push(eq(activityEvents.projectId, filters.projectId));
  }
  if (filters.taskId) {
    conditions.push(eq(activityEvents.taskId, filters.taskId));
  }
  if (filters.severity) {
    conditions.push(eq(activityEvents.severity, filters.severity));
  }
  if (filters.source) {
    conditions.push(eq(activityEvents.source, filters.source));
  }

  return conditions;
}

export function parseActivityEventMetadata(
  event: ActivityEvent,
): Record<string, unknown> {
  return parseJsonObject(event.metadata);
}
