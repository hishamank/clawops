"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Agent {
  id: string;
  name: string;
}

interface FilterControlsProps {
  onFilterChange: (filters: AnalyticsFilters) => void;
  agents?: Agent[];
  initialFilters?: AnalyticsFilters;
}

export interface AnalyticsFilters {
  from: string;
  to: string;
  granularity: "hour" | "day" | "week" | "month";
  agentId?: string;
  model?: string;
}

const GRANULARITY_OPTIONS = [
  { value: "hour", label: "Hour" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
] as const;

function getDefaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function toInputDate(value: string): string {
  return value.includes("T") ? value.slice(0, 10) : value;
}

function toFilterIso(value: string, boundary: "start" | "end"): string {
  const suffix = boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  return new Date(`${value}${suffix}`).toISOString();
}

export function FilterControls({
  onFilterChange,
  agents = [],
  initialFilters,
}: FilterControlsProps): React.JSX.Element {
  const [filters, setFilters] = useState<AnalyticsFilters>(() => {
    if (initialFilters) {
      return {
        ...initialFilters,
        from: toInputDate(initialFilters.from),
        to: toInputDate(initialFilters.to),
      };
    }

    const defaultRange = getDefaultDateRange();
    return {
      from: defaultRange.from,
      to: defaultRange.to,
      granularity: "day",
    };
  });

  const handleApply = () => {
    onFilterChange({
      ...filters,
      from: toFilterIso(filters.from, "start"),
      to: toFilterIso(filters.to, "end"),
    });
  };

  const handleReset = () => {
    const range = getDefaultDateRange();
    const nextFilters: AnalyticsFilters = {
      from: range.from,
      to: range.to,
      granularity: "day",
    };
    setFilters(nextFilters);
    onFilterChange({
      ...nextFilters,
      from: toFilterIso(nextFilters.from, "start"),
      to: toFilterIso(nextFilters.to, "end"),
    });
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Date From */}
          <div className="space-y-1.5">
            <label htmlFor="date-from" className="text-sm font-medium">
              From
            </label>
            <input
              id="date-from"
              type="date"
              value={filters.from}
              onChange={(e) =>
                setFilters({ ...filters, from: e.target.value })
              }
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Date To */}
          <div className="space-y-1.5">
            <label htmlFor="date-to" className="text-sm font-medium">
              To
            </label>
            <input
              id="date-to"
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Granularity */}
          <div className="space-y-1.5">
            <label htmlFor="granularity" className="text-sm font-medium">
              Granularity
            </label>
            <select
              id="granularity"
              value={filters.granularity}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  granularity: e.target.value as AnalyticsFilters["granularity"],
                })
              }
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {GRANULARITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Agent Filter */}
          {agents.length > 0 && (
            <div className="space-y-1.5">
              <label htmlFor="agent" className="text-sm font-medium">
                Agent
              </label>
              <select
                id="agent"
                value={filters.agentId ?? ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    agentId: e.target.value || undefined,
                  })
                }
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Agents</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={handleReset} size="sm">
              Reset
            </Button>
            <Button onClick={handleApply} size="sm">
              Apply
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
