"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Overview",   value: "overview"   },
  { label: "Tasks",      value: "tasks"       },
  { label: "Activity",   value: "activity"    },
  { label: "Automation", value: "automation"  },
] as const;

type TabValue = (typeof tabs)[number]["value"];

const VALID_TABS = new Set(tabs.map((t) => t.value));

function resolveTab(value: string | null): TabValue {
  return value && VALID_TABS.has(value as TabValue) ? (value as TabValue) : "overview";
}

export function AgentTabBar({
  counts,
}: {
  counts?: Partial<Record<TabValue, number>>;
}): React.JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = resolveTab(searchParams.get("tab"));

  function href(tab: TabValue): string {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div className="flex items-center gap-0.5 border-b border-white/8">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.value;
        const count = counts?.[tab.value];
        return (
          <Link
            key={tab.value}
            href={href(tab.value)}
            className={cn(
              "relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "text-[#ededef] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-[#5e6ad2]"
                : "text-[#6b7080] hover:text-[#ededef]",
            )}
          >
            {tab.label}
            {count != null && count > 0 && (
              <span
                className={cn(
                  "flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 font-mono text-[10px] leading-none",
                  isActive ? "bg-[#5e6ad2]/20 text-[#5e6ad2]" : "bg-white/8 text-[#6b7080]",
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
