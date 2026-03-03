"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "All", value: "all" },
  { label: "Raw", value: "raw" },
  { label: "Reviewed", value: "reviewed" },
  { label: "Promoted", value: "promoted" },
  { label: "Archived", value: "archived" },
];

interface IdeaFilterTabsProps {
  current: string;
}

export function IdeaFilterTabs({ current }: IdeaFilterTabsProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={tab.value === "all" ? "/ideas" : `/ideas?status=${tab.value}`}
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
