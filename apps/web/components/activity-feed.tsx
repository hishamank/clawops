import {
  Bot,
  CheckCircle2,
  Lightbulb,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { timeAgo } from "@/lib/time";
import type { Agent } from "@/lib/types";

interface ActivityItem {
  id: string;
  icon: "agent" | "task" | "idea" | "status";
  label: string;
  description: string;
  time: string;
}

const iconMap = {
  agent: Bot,
  task: CheckCircle2,
  idea: Lightbulb,
  status: RefreshCw,
} as const;

function deriveActivity(agents: Agent[]): ActivityItem[] {
  return agents
    .filter((a) => a.lastActive)
    .sort((a, b) => {
      const ta = a.lastActive ? new Date(a.lastActive).getTime() : 0;
      const tb = b.lastActive ? new Date(b.lastActive).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 8)
    .map((agent) => ({
      id: agent.id,
      icon: "status" as const,
      label: agent.name,
      description: `Status: ${agent.status}`,
      time: agent.lastActive ?? "",
    }));
}

interface ActivityFeedProps {
  agents: Agent[];
}

export function ActivityFeed({ agents }: ActivityFeedProps): React.JSX.Element {
  const items = deriveActivity(agents);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No recent activity
          </p>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const Icon = iconMap[item.icon];
              return (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-medium truncate">
                      {item.label}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {item.description}
                    </span>
                  </div>
                  <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                    {timeAgo(item.time)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
