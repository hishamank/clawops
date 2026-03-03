import type { TaskPriority } from "@clawops/domain";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const priorityStyles: Record<TaskPriority, string> = {
  urgent: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  high: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  medium: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  low: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const priorityLabels: Record<TaskPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

interface PriorityBadgeProps {
  priority: TaskPriority;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps): React.JSX.Element {
  return (
    <Badge
      variant="outline"
      className={cn(priorityStyles[priority], className)}
    >
      {priorityLabels[priority]}
    </Badge>
  );
}
