"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SectionEditorProps {
  ideaId: string;
  sectionKey: string;
  label: string;
  initialContent: string | null;
  readOnly?: boolean;
}

export function SectionEditor({
  ideaId,
  sectionKey,
  label,
  initialContent,
  readOnly,
}: SectionEditorProps): React.JSX.Element {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(initialContent ?? "");
  const [isPending, startTransition] = useTransition();

  async function handleSave(): Promise<void> {
    const res = await fetch(`/api/ideas/${ideaId}/sections/${sectionKey}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      setEditing(false);
      startTransition(() => {
        router.refresh();
      });
    }
  }

  function handleCancel(): void {
    setContent(initialContent ?? "");
    setEditing(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{label}</CardTitle>
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
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleSave}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleCancel}
                disabled={isPending}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[120px] font-sans"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Add ${label.toLowerCase()}...`}
          />
        ) : initialContent ? (
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground font-sans">
            {initialContent}
          </pre>
        ) : (
          <button
            type="button"
            onClick={() => !readOnly && setEditing(true)}
            className="w-full text-left text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer"
            disabled={readOnly}
          >
            Click to add {label.toLowerCase()}...
          </button>
        )}
      </CardContent>
    </Card>
  );
}
