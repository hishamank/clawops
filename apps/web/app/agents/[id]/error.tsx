"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AgentErrorPage({ error, reset }: ErrorPageProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h2 className="text-xl font-semibold mb-2">Failed to load agent</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        {error.message || "Could not load this agent's profile."}
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline">
          Try Again
        </Button>
        <Link href="/">
          <Button variant="ghost">Back to Fleet</Button>
        </Link>
      </div>
    </div>
  );
}
