"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "All",      value: "all"      },
  { label: "Raw",      value: "raw"      },
  { label: "Reviewed", value: "reviewed" },
  { label: "Promoted", value: "promoted" },
  { label: "Archived", value: "archived" },
] as const;

type TabValue = (typeof tabs)[number]["value"];

interface IdeaFilterTabsProps {
  current: string;
  counts?: Partial<Record<TabValue, number>>;
}

export function IdeaFilterTabs({ current, counts }: IdeaFilterTabsProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-white/8 bg-[#0d0d1a] p-1">
      {tabs.map((tab) => {
        const isActive = current === tab.value;
        const count = counts?.[tab.value];
        return (
          <Link
            key={tab.value}
            href={tab.value === "all" ? "/ideas" : `/ideas?status=${tab.value}`}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-[#5e6ad2]/20 text-[#5e6ad2]"
                : "text-[#6b7080] hover:bg-white/5 hover:text-[#ededef]",
            )}
          >
            {tab.label}
            {count != null && count > 0 && (
              <span
                className={cn(
                  "flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 font-mono text-[10px] leading-none",
                  isActive
                    ? "bg-[#5e6ad2]/30 text-[#5e6ad2]"
                    : "bg-white/8 text-[#6b7080]",
                )}
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
