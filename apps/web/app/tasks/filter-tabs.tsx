"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "All", value: "all" },
  { label: "Backlog", value: "backlog" },
  { label: "Todo", value: "todo" },
  { label: "In Progress", value: "in-progress" },
  { label: "Review", value: "review" },
  { label: "Done", value: "done" },
];

interface TaskFilterTabsProps {
  current: string;
}

export function TaskFilterTabs({ current }: TaskFilterTabsProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={tab.value === "all" ? "/tasks" : `/tasks?status=${tab.value}`}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            current === tab.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
