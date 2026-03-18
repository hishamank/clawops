import { Bot, CheckSquare, Lightbulb, DollarSign, AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { Agent, TokenSummary, Task } from "@/lib/types";
import { StatsCard } from "@/components/stats-card";
import { AgentCard } from "@/components/agent-card";
import { ActivityFeed } from "@/components/activity-feed";
import { OnboardingBanner } from "@/components/onboarding/onboarding-banner";
import { listAgents } from "@clawops/agents";
import { listTasks, getBlockedTaskIds } from "@clawops/tasks";
import { listIdeas } from "@clawops/ideas";
import { getTokenSummary as getAnalyticsTokenSummary } from "@clawops/analytics";
import { getDb } from "@/lib/server/runtime";
import { listActivityEvents } from "./activity/actions";
import { mapAgent, mapTask } from "@/lib/mappers";
import { StatusBadge } from "@/components/status-badge";
import { PriorityBadge } from "@/components/priority-badge";

export const dynamic = "force-dynamic";

interface DashboardData {
  agents: Agent[];
  activeCount: number;
  activeTasks: number;
  blockedTasks: Pick<Task, "id" | "title" | "status" | "priority">[];
  ideasQueued: number;
  tokenSummary: TokenSummary;
}

async function getDashboardData(): Promise<DashboardData> {
  const db = getDb();

  const agentsRaw = listAgents(db);
  const agents = agentsRaw.map(mapAgent);
  const activeCount = agents.filter((a) => a.status === "online" || a.status === "busy").length;

  const allTasksRaw = listTasks(db);
  const allTasks = allTasksRaw.map(mapTask);
  const nonTerminal = allTasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const blockedIds = getBlockedTaskIds(db, nonTerminal.map((t) => t.id));
  const blockedTasks: Pick<Task, "id" | "title" | "status" | "priority">[] = nonTerminal
    .filter((t) => blockedIds.has(t.id))
    .map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority }));

  const allIdeas = listIdeas(db);
  const ideasQueued = allIdeas.filter((i) => i.status === "raw" || i.status === "reviewed").length;

  const summary = getAnalyticsTokenSummary(db, {});
  const tokenSummary: TokenSummary = {
    totalTokensIn: summary.totalIn,
    totalTokensOut: summary.totalOut,
    totalCost: summary.totalCost,
  };

  return { agents, activeCount, activeTasks: nonTerminal.length, blockedTasks, ideasQueued, tokenSummary };
}

export default async function FleetOverview(): Promise<React.JSX.Element> {
  const [data, initialEvents] = await Promise.all([
    getDashboardData(),
    listActivityEvents({ limit: 20 }),
  ]);

  const { agents, activeCount, activeTasks, blockedTasks, ideasQueued, tokenSummary } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#ededef]">
          Operations Overview
        </h1>
        <p className="mt-0.5 text-sm text-[#6b7080]">
          Strategic management layer for your autonomous agent fleet.
        </p>
      </div>

      {/* Onboarding banner */}
      {agents.length === 0 && <OnboardingBanner />}

      {/* Needs Attention */}
      {blockedTasks.length > 0 && (
        <section className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <span className="text-sm font-medium text-rose-300">
              Needs Attention · {blockedTasks.length} blocked {blockedTasks.length === 1 ? "task" : "tasks"}
            </span>
          </div>
          <div className="space-y-1">
            {blockedTasks.slice(0, 5).map((t) => (
              <Link
                key={t.id}
                href={`/tasks/${t.id}`}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-rose-500/10"
              >
                <StatusBadge status={t.status} />
                <PriorityBadge priority={t.priority} />
                <span className="min-w-0 flex-1 truncate text-sm text-[#ededef]/80">{t.title}</span>
              </Link>
            ))}
            {blockedTasks.length > 5 && (
              <Link
                href="/tasks?status=blocked"
                className="block px-2 py-1 text-xs text-rose-400/70 hover:text-rose-400"
              >
                +{blockedTasks.length - 5} more blocked tasks →
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          title="Active Agents"
          value={activeCount}
          icon={Bot}
          description={`${agents.length} total registered`}
        />
        <StatsCard
          title="Active Tasks"
          value={activeTasks}
          icon={CheckSquare}
          description="Non-done, non-cancelled"
          variant={blockedTasks.length > 0 ? "warning" : "default"}
        />
        <StatsCard
          title="Ideas Queued"
          value={ideasQueued}
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Agent Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#ededef]">Agent Fleet</h2>
            <span className="text-xs text-[#6b7080]">
              {agents.length} {agents.length === 1 ? "agent" : "agents"}
            </span>
          </div>
          {agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/8 py-14 text-center">
              <Bot className="mb-3 h-9 w-9 text-[#6b7080]" />
              <p className="text-sm text-[#6b7080]">No agents registered yet.</p>
              <p className="mt-1 text-xs text-[#6b7080]/60">
                Use{" "}
                <code className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[0.8em] text-[#ededef]">
                  clawops agent init
                </code>{" "}
                to register your first agent.
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
        <div>
          <ActivityFeed agents={agents} embedded initialEvents={initialEvents} />
        </div>
      </div>
    </div>
  );
}
