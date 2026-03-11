import { Activity } from "lucide-react";
import type { Agent } from "@/lib/types";
import { ActivityFeed } from "@/components/activity-feed";
import { listAgents } from "@clawops/agents";
import { getDb } from "@/lib/server/runtime";

export const dynamic = "force-dynamic";

async function getAgents(): Promise<Agent[]> {
  const rows = listAgents(getDb());
  return rows.map(({ apiKey: _apiKey, ...rest }) => rest) as unknown as Agent[];
}

export default async function ActivityPage(): Promise<React.JSX.Element> {
  const agents = await getAgents();

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
        <ActivityFeed agents={agents} />
      </div>
    </div>
  );
}
