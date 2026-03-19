"use client";

import { useRef, useState, useCallback } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import { useRouter } from "next/navigation";

interface SyncButtonProps {
  disabled?: boolean;
}

export function SyncButton({ disabled = false }: SyncButtonProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSync = useCallback(async () => {
    if (isLoading || disabled) {
      return;
    }

    if (debounceRef.current) {
      return;
    }

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
    }, 500);

    setIsLoading(true);

    try {
      const response = await fetch("/api/sync/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(
          "Sync failed",
          data.error || "Failed to run sync. Please try again."
        );
        return;
      }

      toast.success(
        "Sync completed",
        `Synced ${data.counts.agents} agents, ${data.counts.cronJobs} cron jobs`
      );

      router.refresh();
    } catch {
      toast.error("Sync failed", "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, disabled, toast, router]);

  const isDisabled = isLoading || disabled;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={isDisabled}
      className="gap-2"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      Sync Now
    </Button>
  );
}