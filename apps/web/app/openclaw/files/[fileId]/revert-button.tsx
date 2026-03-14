"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { revertFileRevisionAction } from "./actions";

interface RevertButtonProps {
  revisionId: string;
  fileId: string;
  hasContent: boolean;
}

export function RevertButton({ revisionId, fileId, hasContent }: RevertButtonProps): React.JSX.Element | null {
  if (!hasContent) {
    return null;
  }

  return <RevertButtonInner revisionId={revisionId} fileId={fileId} />;
}

function RevertButtonInner({ revisionId, fileId }: { revisionId: string; fileId: string }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleClick() {
    const confirmed = window.confirm(
      "Revert file to this revision? This will overwrite the current file content on the connected workspace.",
    );
    if (!confirmed) return;

    setStatus("idle");
    setErrorMessage(null);

    startTransition(async () => {
      const result = await revertFileRevisionAction(revisionId, fileId);
      if (result.success) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMessage(result.error ?? "Revert failed");
      }
    });
  }

  if (status === "success") {
    return <span className="text-xs text-green-600">Reverted</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? "Reverting…" : "Revert to this"}
      </Button>
      {status === "error" && errorMessage && (
        <span className="text-xs text-destructive">{errorMessage}</span>
      )}
    </div>
  );
}
