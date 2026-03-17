import { Info, RefreshCw } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface PanelEmptyStateProps {
  description: string;
  diagnostic?: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}

export function PanelEmptyState({
  description,
  diagnostic,
  actionLabel,
  actionHref,
  className,
}: PanelEmptyStateProps): React.JSX.Element {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm text-muted-foreground">{description}</p>
      {diagnostic && (
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs">
          <Info className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">{diagnostic}</span>
            {actionLabel && actionHref && (
              <Link
                href={actionHref}
                className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
              >
                <RefreshCw className="h-3 w-3" />
                {actionLabel}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}