import Link from "next/link";
import { FileText, Ban } from "lucide-react";
import type { Task } from "@/lib/types";
import { timeAgo } from "@/lib/time";
import { StatusBadge } from "@/components/status-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface TaskCardProps {
  task: Task;
  agentMap?: Map<string, string>;
  projectMap?: Map<string, string>;
  showAssignee?: boolean;
  showProject?: boolean;
  showSpec?: boolean;
  blocked?: boolean;
  href?: string;
  compact?: boolean;
}

export function TaskCard({
  task,
  agentMap,
  projectMap,
  showAssignee = true,
  showProject = true,
  showSpec = true,
  blocked = false,
  href,
  compact = true,
}: TaskCardProps): React.JSX.Element {
  const target = href ?? `/tasks/${task.id}`;

  return (
    <Link href={target}>
      <Card className="transition-colors hover:bg-accent/50 cursor-pointer py-2">
        <CardContent className={cn("flex items-center gap-4", compact ? "py-0" : "py-2")}>
          <PriorityBadge priority={task.priority} />
          <span className="text-sm font-medium truncate min-w-0 flex-1">
            {task.title}
          </span>
          <StatusBadge status={task.status} />
          {blocked && (
            <Ban className="h-4 w-4 text-rose-400 shrink-0" />
          )}
          {showSpec && task.specContent && (
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          {showAssignee && (
            <span className="text-xs text-muted-foreground shrink-0 w-24 text-right">
              {task.assigneeId
                ? agentMap?.get(task.assigneeId) ?? "Unknown"
                : "Unassigned"}
            </span>
          )}
          {showProject && (
            <span className="text-xs text-muted-foreground shrink-0 w-20 text-right">
              {task.projectId
                ? projectMap?.get(task.projectId) ?? "—"
                : "—"}
            </span>
          )}
          <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">
            {timeAgo(task.createdAt)}
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
