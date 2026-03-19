"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApiKey } from "@/lib/auth";

interface PromoteButtonProps {
  ideaId: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function PromoteButton({ ideaId, disabled, disabledReason }: PromoteButtonProps): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handlePromote(): Promise<void> {
    setError(null);
    try {
      const apiKey = getApiKey();
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers["x-api-key"] = apiKey;
      }

      const res = await fetch(`/api/ideas/${ideaId}/promote`, {
        method: "POST",
        headers,
      });
      if (!res.ok) {
        setError("Failed to promote");
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError("Failed to promote");
    }
  }

  const reasonId = disabled && disabledReason ? `${ideaId}-promote-reason` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {error && <span className="text-xs text-rose-400">{error}</span>}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePromote}
          disabled={isPending || disabled}
          className="h-7 text-xs"
          aria-describedby={reasonId}
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ArrowUpRight className="h-3 w-3" />
          )}
          Promote
        </Button>
      </div>
      {reasonId && (
        <p id={reasonId} className="text-xs text-muted-foreground">
          {disabledReason}
        </p>
      )}
    </div>
  );
}
