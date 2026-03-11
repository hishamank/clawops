import { Activity } from "lucide-react";
import type { Agent } from "@/lib/types";
import { ActivityFeed } from "@/components/activity-feed";
import { listAgents } from "@clawops/agents";
import { getDb } from "@/lib/server/runtime";
import { listActivityEvents } from "./actions";

export const dynamic = "force-dynamic";

async function getAgents(): Promise<Agent[]> {
  const rows = listAgents(getDb());
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    model: row.model,
    role: row.role,
    status: row.status,
    lastActive: row.lastActive ? row.lastActive.toISOString() : null,
    avatar: row.avatar,
    framework: row.framework,
    memoryPath: row.memoryPath,
    skills: row.skills,
    createdAt: row.createdAt.toISOString(),
  }));
}

export default async function ActivityPage(): Promise<React.JSX.Element> {
  const agents = await getAgents();
  const initialEvents = await listActivityEvents();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Activity</h1>
          <p className="mt-1 text-muted-foreground">
            Central hub for agent operations, changes, and events.
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Activity className="h-5 w-5" />
        </div>
      </div>

      {/* Full-page activity feed */}
      <div className="min-h-[600px]">
        <ActivityFeed agents={agents} initialEvents={initialEvents} />
      </div>
    </div>
  );
}
