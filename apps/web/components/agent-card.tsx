import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import type { Agent } from "@/lib/types";

const statusDot: Record<Agent["status"], string> = {
  online:  "bg-emerald-500",
  busy:    "bg-amber-500",
  idle:    "bg-amber-500",
  offline: "bg-[#6b7080]/50",
};

const statusLabel: Record<Agent["status"], string> = {
  online:  "Active",
  busy:    "Busy",
  idle:    "Idle",
  offline: "Offline",
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface AgentCardProps {
  agent: Agent;
  activeTasks?: number;
}

export function AgentCard({ agent, activeTasks }: AgentCardProps): React.JSX.Element {
  return (
    <Link href={`/agents/${agent.id}`}>
      <Card className="py-0 cursor-pointer transition-colors hover:bg-white/[0.03]">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5e6ad2]/10 font-semibold text-sm text-[#5e6ad2]">
              {agent.avatar ?? getInitials(agent.name)}
            </div>

            {/* Details */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-[#ededef]">{agent.name}</span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <div className={cn("h-1.5 w-1.5 rounded-full", statusDot[agent.status])} />
                  <span className="text-[11px] text-[#6b7080]">{statusLabel[agent.status]}</span>
                </div>
              </div>

              <p className="mt-0.5 truncate text-xs text-[#6b7080]">{agent.role}</p>

              <div className="mt-2 flex items-center gap-2">
                <span className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[10px] text-[#6b7080]">
                  {agent.modelAlias ?? agent.model}
                </span>
                {agent.framework && (
                  <span className="rounded border border-white/8 px-1.5 py-0.5 text-[10px] text-[#6b7080]">
                    {agent.framework}
                  </span>
                )}
              </div>

              {/* Task load bar */}
              {activeTasks != null && (
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] text-[#6b7080]">Active tasks</span>
                    <span className="font-mono text-[10px] text-[#6b7080]">{activeTasks}</span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        activeTasks === 0
                          ? "w-0"
                          : activeTasks <= 3
                          ? "bg-emerald-500"
                          : activeTasks <= 7
                          ? "bg-amber-500"
                          : "bg-rose-500",
                      )}
                      style={{ width: `${Math.min(activeTasks * 10, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <p className="mt-2 text-[10px] text-[#6b7080]/60">
                Active {timeAgo(agent.lastActive)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
