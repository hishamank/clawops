import { AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface PanelErrorStateProps {
  title?: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}

export function PanelErrorState({
  title = "Failed to load",
  message,
  actionLabel,
  actionHref,
  className,
}: PanelErrorStateProps): React.JSX.Element {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
        <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-destructive">{title}</span>
          <span className="text-xs text-muted-foreground">{message}</span>
          {actionLabel && actionHref && (
            <Link
              href={actionHref}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
            >
              <RefreshCw className="h-3 w-3" />
              {actionLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}