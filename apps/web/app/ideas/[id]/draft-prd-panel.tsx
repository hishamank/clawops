"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Pencil, Save, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DraftPrdPanelProps {
  ideaId: string;
  initialContent: string | null;
  readOnly?: boolean;
}

export function DraftPrdPanel({
  ideaId,
  initialContent,
  readOnly,
}: DraftPrdPanelProps): React.JSX.Element {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(initialContent ?? "");
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  async function handleSave(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/ideas/${ideaId}/draft-prd`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        setError("Failed to save");
        return;
      }
      setEditing(false);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel(): void {
    setContent(initialContent ?? "");
    setEditing(false);
    setError(null);
  }

  const busy = saving || isPending;

  return (
    <Card className="border-indigo-500/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-400" />
            <CardTitle className="text-sm font-medium">Draft PRD</CardTitle>
          </div>
          {!readOnly && !editing && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {editing && (
            <div className="flex items-center gap-1">
              {error && (
                <span className="text-xs text-rose-400 mr-1">{error}</span>
              )}
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleSave}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleCancel}
                disabled={busy}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-2">
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[200px] font-sans"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your product requirements document..."
            />
            <p className="text-xs text-muted-foreground text-right">
              {wordCount} {wordCount === 1 ? "word" : "words"}
            </p>
          </div>
        ) : initialContent ? (
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground font-sans">
            {initialContent}
          </pre>
        ) : (
          <button
            type="button"
            onClick={() => !readOnly && setEditing(true)}
            className="w-full text-left text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer py-4"
            disabled={readOnly}
          >
            Click to start writing the PRD...
          </button>
        )}
      </CardContent>
    </Card>
  );
}
