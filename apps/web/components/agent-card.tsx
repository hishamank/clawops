import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import type { Agent } from "@/lib/types";

const statusColors: Record<Agent["status"], string> = {
  online: "bg-emerald-500",
  busy: "bg-amber-500",
  idle: "bg-amber-500",
  offline: "bg-zinc-500",
};

const statusLabels: Record<Agent["status"], string> = {
  online: "Active",
  busy: "Busy",
  idle: "Idle",
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
}

export function AgentCard({ agent }: AgentCardProps): React.JSX.Element {
  return (
    <Link href={`/agents/${agent.id}`}>
      <Card className="py-4 transition-colors hover:bg-accent/50 cursor-pointer">
        <CardContent className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-semibold text-sm">
            {agent.avatar ?? getInitials(agent.name)}
          </div>

          {/* Details */}
          <div className="flex flex-1 flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{agent.name}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <div
                  className={cn("h-2 w-2 rounded-full", statusColors[agent.status])}
                />
                <span className="text-xs text-muted-foreground">
                  {statusLabels[agent.status]}
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground truncate">{agent.role}</p>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {agent.model}
              </Badge>
              {agent.framework && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {agent.framework}
                </Badge>
              )}
            </div>

            <span className="text-[11px] text-muted-foreground mt-0.5">
              Active {timeAgo(agent.lastActive)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
