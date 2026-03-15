import { CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { IdeaSections } from "@clawops/ideas";

interface ReadinessTrackerProps {
  sections: IdeaSections;
  taskCount: number;
  hasDescription: boolean;
}

interface CheckItem {
  label: string;
  done: boolean;
}

export function ReadinessTracker({
  sections,
  taskCount,
  hasDescription,
}: ReadinessTrackerProps): React.JSX.Element {
  const items: CheckItem[] = [
    { label: "Description", done: hasDescription },
    { label: "Brainstorming", done: !!sections.brainstorming },
    { label: "Research", done: !!sections.research },
    { label: "Draft PRD", done: !!sections.draftPrd },
    { label: "Tasks", done: taskCount >= 1 },
  ];

  const completed = items.filter((i) => i.done).length;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Readiness</span>
            <span className="text-xs text-muted-foreground">
              {completed} of {items.length}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className="bg-primary rounded-full h-1.5 transition-all"
              style={{ width: `${(completed / items.length) * 100}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            {items.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-1.5 text-xs"
              >
                {item.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span
                  className={
                    item.done ? "text-foreground" : "text-muted-foreground"
                  }
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
