"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowDownRight, ArrowUpRight, DollarSign, Users } from "lucide-react";
import type { TokenSummary } from "@/lib/types";
import { StatsCard } from "@/components/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TimelineChart } from "@/components/analytics/timeline-chart";
import { FilterControls, type AnalyticsFilters } from "@/components/analytics/filter-controls";

interface CostBreakdownItem {
  name: string;
  totalCost: number;
  totalTokensIn: number;
  totalTokensOut: number;
}

interface TemplateBreakdownItem {
  templateId: string;
  templateName: string | null;
  totalCost: number;
  totalTokensIn: number;
  totalTokensOut: number;
  count: number;
}

interface TimelinePoint {
  timestamp: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  count: number;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function BreakdownList({ items }: { items: CostBreakdownItem[] }): React.JSX.Element {
  const maxCost = items.length > 0 ? Math.max(...items.map((i) => i.totalCost)) : 0;

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No data available for this breakdown.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.name} className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{item.name}</span>
            <span className="font-semibold">${item.totalCost.toFixed(2)}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{
                width: maxCost > 0 ? `${(item.totalCost / maxCost) * 100}%` : "0%",
              }}
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{formatNumber(item.totalTokensIn)} tokens in</span>
            <span>{formatNumber(item.totalTokensOut)} tokens out</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TemplateBreakdownList({ items }: { items: TemplateBreakdownItem[] }): React.JSX.Element {
  const maxCost = items.length > 0 ? Math.max(...items.map((i) => i.totalCost)) : 0;

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No template data available. Tasks must be linked to templates.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.templateId} className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{item.templateName ?? item.templateId}</span>
            <span className="font-semibold">${item.totalCost.toFixed(2)}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{
                width: maxCost > 0 ? `${(item.totalCost / maxCost) * 100}%` : "0%",
              }}
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{item.count} tasks</span>
            <span>{formatNumber(item.totalTokensIn)} tokens</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsContent(): React.JSX.Element {
  const [tokenSummary, setTokenSummary] = useState<TokenSummary>({
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalCost: 0,
  });
  const [byAgent, setByAgent] = useState<CostBreakdownItem[]>([]);
  const [byModel, setByModel] = useState<CostBreakdownItem[]>([]);
  const [byProject, setByProject] = useState<CostBreakdownItem[]>([]);
  const [byTemplate, setByTemplate] = useState<TemplateBreakdownItem[]>([]);
  const [tokenTimeline, setTokenTimeline] = useState<TimelinePoint[]>([]);
  const [costTimeline, setCostTimeline] = useState<TimelinePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<AnalyticsFilters | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (appliedFilters?: AnalyticsFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const summaryRes = await fetch("/api/analytics/tokens");
      if (!summaryRes.ok) {
        const statusText = summaryRes.statusText ? ` ${summaryRes.statusText}` : "";
        throw new Error(`Failed to fetch token summary: ${summaryRes.status}${statusText}`);
      }
      const summary = await summaryRes.json();

      const [agentRes, modelRes, projectRes, templateRes] = await Promise.all([
        fetch("/api/analytics/costs?groupBy=agent"),
        fetch("/api/analytics/costs?groupBy=model"),
        fetch("/api/analytics/costs?groupBy=project"),
        fetch("/api/analytics/costs/by-template"),
      ]);

      const errorMessages: string[] = [];
      if (!agentRes.ok) errorMessages.push(`agent: ${agentRes.status}${agentRes.statusText ? ` ${agentRes.statusText}` : ""}`);
      if (!modelRes.ok) errorMessages.push(`model: ${modelRes.status}${modelRes.statusText ? ` ${modelRes.statusText}` : ""}`);
      if (!projectRes.ok) errorMessages.push(`project: ${projectRes.status}${projectRes.statusText ? ` ${projectRes.statusText}` : ""}`);
      if (!templateRes.ok) errorMessages.push(`template: ${templateRes.status}${templateRes.statusText ? ` ${templateRes.statusText}` : ""}`);

      if (errorMessages.length > 0) {
        throw new Error(`Failed to fetch cost breakdowns: ${errorMessages.join(", ")}`);
      }

      const [byAgentData, byModelData, byProjectData, byTemplateData] = await Promise.all([
        agentRes.json(),
        modelRes.json(),
        projectRes.json(),
        templateRes.json(),
      ]);

      setTokenSummary({
        totalTokensIn: summary.totalTokensIn,
        totalTokensOut: summary.totalTokensOut,
        totalCost: summary.totalCost,
      });
      setByAgent(byAgentData);
      setByModel(byModelData);
      setByProject(byProjectData);
      setByTemplate(byTemplateData);

      if (appliedFilters) {
        const [tokenTimelineRes, costTimelineRes] = await Promise.all([
          fetch(`/api/analytics/tokens/timeline?from=${appliedFilters.from}&to=${appliedFilters.to}&granularity=${appliedFilters.granularity}`),
          fetch(`/api/analytics/costs/timeline?from=${appliedFilters.from}&to=${appliedFilters.to}&granularity=${appliedFilters.granularity}`),
        ]);
        if (tokenTimelineRes.ok) setTokenTimeline(await tokenTimelineRes.json());
        if (costTimelineRes.ok) setCostTimeline(await costTimelineRes.json());
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch analytics";
      setError(message);
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to fetch analytics:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = (newFilters: AnalyticsFilters) => {
    setFilters(newFilters);
    fetchData(newFilters);
  };

  const agentCount = byAgent.length;
  const avgCostPerAgent = agentCount > 0 ? tokenSummary.totalCost / agentCount : 0;
  const hasData =
    tokenSummary.totalTokensIn > 0 ||
    tokenSummary.totalTokensOut > 0 ||
    tokenSummary.totalCost > 0;

  const tabs = [
    { label: "By Agent", items: byAgent },
    { label: "By Model", items: byModel },
    { label: "By Project", items: byProject },
  ] as const;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-muted-foreground">
            Token usage and cost intelligence across your fleet.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="py-8">
                <div className="animate-pulse h-4 bg-muted rounded w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-muted-foreground">
            Token usage and cost intelligence across your fleet.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/50 bg-destructive/10 p-8 text-center">
          <p className="text-sm text-destructive">
            Failed to load analytics data.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {error}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => fetchData()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Token usage and cost intelligence across your fleet.
        </p>
      </div>

      {/* Filter Controls */}
      <FilterControls onFilterChange={handleFilterChange} />

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Tokens In"
          value={formatNumber(tokenSummary.totalTokensIn)}
          icon={ArrowDownRight}
          description="Input tokens"
        />
        <StatsCard
          title="Total Tokens Out"
          value={formatNumber(tokenSummary.totalTokensOut)}
          icon={ArrowUpRight}
          description="Output tokens"
        />
        <StatsCard
          title="Total Cost"
          value={`$${tokenSummary.totalCost.toFixed(2)}`}
          icon={DollarSign}
          description="All agents combined"
        />
        <StatsCard
          title="Avg Cost per Agent"
          value={`$${avgCostPerAgent.toFixed(2)}`}
          icon={Users}
          description={`${agentCount} ${agentCount === 1 ? "agent" : "agents"}`}
        />
      </div>

      {/* Timeline Charts */}
      {filters && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TimelineChart
            data={tokenTimeline.map((p) => ({
              timestamp: p.timestamp.split(" ")[1] || p.timestamp,
              value: p.tokensIn + p.tokensOut,
            }))}
            title="Token Usage Over Time"
            color="hsl(var(--indigo))"
            formatValue={formatNumber}
          />
          <TimelineChart
            data={costTimeline.map((p) => ({
              timestamp: p.timestamp.split(" ")[1] || p.timestamp,
              value: p.cost,
            }))}
            title="Cost Over Time"
            color="hsl(var(--emerald))"
            formatValue={(v) => `$${v.toFixed(2)}`}
          />
        </div>
      )}

      {/* Cost breakdown */}
      {!hasData ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <DollarSign className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No usage data yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Agents report token usage when completing tasks.
          </p>
        </div>
      ) : (
        <>
          {/* Breakdown tabs */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {tabs.map((tab) => (
              <Card key={tab.label} className="py-4">
                <CardHeader>
                  <CardTitle className="text-base">{tab.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <BreakdownList items={tab.items} />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Template breakdown */}
          <Card className="py-4">
            <CardHeader>
              <CardTitle className="text-base">By Task Template</CardTitle>
            </CardHeader>
            <CardContent>
              <TemplateBreakdownList items={byTemplate} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
