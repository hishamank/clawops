import { Bot, CheckSquare, Lightbulb, DollarSign, Search, Plus } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Agent, TokenSummary } from "@/lib/types";
import { StatsCard } from "@/components/stats-card";
import { AgentCard } from "@/components/agent-card";
import { ActivityFeed } from "@/components/activity-feed";
import { Button } from "@/components/ui/button";

async function getAgents(): Promise<Agent[]> {
  try {
    return await api<Agent[]>("/agents", { tags: ["agents"] });
  } catch {
    return [];
  }
}

async function getTokenSummary(): Promise<TokenSummary> {
  try {
    return await api<TokenSummary>("/analytics/tokens", { tags: ["analytics"] });
  } catch {
    return { totalTokensIn: 0, totalTokensOut: 0, totalCost: 0 };
  }
}

export default async function FleetOverview(): Promise<React.JSX.Element> {
  const [agents, tokenSummary] = await Promise.all([
    getAgents(),
    getTokenSummary(),
  ]);

  const activeAgents = agents.filter((a) => a.status === "online" || a.status === "busy");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Operations Overview
          </h1>
          <p className="mt-1 text-muted-foreground">
            Strategic management layer for your autonomous agent fleet.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Search...</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Active Agents"
          value={activeAgents.length}
          icon={Bot}
          description={`${agents.length} total`}
        />
        <StatsCard
          title="Tasks Today"
          value={0}
          icon={CheckSquare}
          description="Across all agents"
        />
        <StatsCard
          title="Ideas Queued"
          value={0}
          icon={Lightbulb}
          description="Awaiting review"
        />
        <StatsCard
          title="Spend This Month"
          value={`$${tokenSummary.totalCost.toFixed(2)}`}
          icon={DollarSign}
          description="All agents combined"
        />
      </div>

      {/* Two-column layout: agent grid + activity feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* Agent Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Agent Fleet</h2>
            <span className="text-xs text-muted-foreground">
              {agents.length} {agents.length === 1 ? "agent" : "agents"}
            </span>
          </div>
          {agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
              <Bot className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                No agents registered yet.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Use <code className="text-primary">clawops agent init</code> to register your first agent.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="space-y-4">
          <ActivityFeed agents={agents} />
        </div>
      </div>

      {/* Quick-add idea FAB */}
      <Link
        href="/ideas"
        className="fixed bottom-8 right-8 z-50"
      >
        <Button size="lg" className="h-14 w-14 rounded-full shadow-lg p-0">
          <Plus className="h-6 w-6" />
          <span className="sr-only">Add Idea</span>
        </Button>
      </Link>
    </div>
  );
}
