export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  tasks,
  activityEvents,
  openclawSessions,
  agentMessages,
  eq,
  or,
  desc,
  and,
  type OpenClawSession,
  type AgentMessage,
  type ActivityEvent,
} from "@clawops/core";
import { getAgent, getOpenClawMappingByAgentId } from "@clawops/agents";
import { getHabitStreak, listHabits, type Habit } from "@clawops/habits";
import { listCronJobs } from "@clawops/habits";
import { getDb, jsonError } from "@/lib/server/runtime";

const idParams = z.object({ id: z.string().min(1) });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = idParams.parse(await params);
    const db = getDb();
    const agent = getAgent(db, id);
    if (!agent) {
      return jsonError(404, "Agent not found", "NOT_FOUND");
    }

    const { apiKey: _apiKey, ...safeAgent } = agent;
    const recentTasks = db
      .select()
      .from(tasks)
      .where(eq(tasks.assigneeId, id))
      .orderBy(desc(tasks.createdAt))
      .limit(10)
      .all();

    const habits = listHabits(db, id);
    const habitsWithStreaks = habits.map((h) => ({
      ...h,
      streaks: getHabitStreak(db, h.id, 7),
    }));

    // OpenClaw mapping
    const openclawMapping = getOpenClawMappingByAgentId(db, id);

    // Sessions — scoped to connection + external agent ID
    let sessions: OpenClawSession[] = [];
    if (openclawMapping) {
      sessions = db
        .select()
        .from(openclawSessions)
        .where(
          and(
            eq(openclawSessions.connectionId, openclawMapping.connectionId),
            eq(openclawSessions.agentId, openclawMapping.externalAgentId),
          ),
        )
        .orderBy(desc(openclawSessions.updatedAt))
        .limit(10)
        .all() as OpenClawSession[];
    }

    // Cron jobs — habits of type "cron" for this agent
    const cronJobs = listCronJobs(db).filter((h) => h.agentId === id) as Habit[];

    // Messages — sent or received by this agent's external ID
    let messages: AgentMessage[] = [];
    if (openclawMapping) {
      messages = db
        .select()
        .from(agentMessages)
        .where(
          or(
            eq(agentMessages.fromAgentId, openclawMapping.externalAgentId),
            eq(agentMessages.toAgentId, openclawMapping.externalAgentId),
          ),
        )
        .orderBy(desc(agentMessages.sentAt))
        .limit(10)
        .all() as AgentMessage[];
    }

    // Activity events for this agent
    const activity = db
      .select()
      .from(activityEvents)
      .where(eq(activityEvents.agentId, id))
      .orderBy(desc(activityEvents.createdAt))
      .limit(15)
      .all() as ActivityEvent[];

    return NextResponse.json({
      ...safeAgent,
      recentTasks,
      habits: habitsWithStreaks,
      sessions,
      cronJobs,
      messages,
      activity,
      openclawMapping,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }
    return jsonError(500, err instanceof Error ? err.message : "Failed to get agent", "INTERNAL_ERROR");
  }
}
