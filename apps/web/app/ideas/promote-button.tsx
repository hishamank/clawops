"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PromoteButtonProps {
  ideaId: string;
}

export function PromoteButton({ ideaId }: PromoteButtonProps): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handlePromote(): Promise<void> {
    setError(null);
    try {
      const res = await fetch(`/api/ideas/${ideaId}/promote`, {
        method: "POST",
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

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-xs text-rose-400">{error}</span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handlePromote}
        disabled={isPending}
        className="h-7 text-xs"
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ArrowUpRight className="h-3 w-3" />
        )}
        Promote
      </Button>
    </div>
  );
}
