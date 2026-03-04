import type { TaskStatus } from "@clawops/domain";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<TaskStatus, string> = {
  backlog: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  todo: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "in-progress": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  review: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  done: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  cancelled: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

const statusLabels: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  "in-progress": "In Progress",
  review: "Review",
  done: "Done",
  cancelled: "Cancelled",
};

interface StatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps): React.JSX.Element {
  return (
    <Badge
      variant="outline"
      className={cn(statusStyles[status], className)}
    >
      {statusLabels[status]}
    </Badge>
  );
}
