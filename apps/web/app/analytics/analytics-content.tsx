"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowDownRight, ArrowUpRight, DollarSign, Users } from "lucide-react";
import type { TokenSummary } from "@/lib/types";
import { StatsCard } from "@/components/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TimelineChart } from "@/components/analytics/timeline-chart";
import { FilterControls, type AnalyticsFilters } from "@/components/analytics/filter-controls";
import { cn } from "@/lib/utils";
import { getApiKey } from "@/lib/auth";

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

function BreakdownRow({ item, maxCost }: { item: CostBreakdownItem; maxCost: number }): React.JSX.Element {
  const pct = maxCost > 0 ? (item.totalCost / maxCost) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#ededef]">{item.name}</span>
        <span className="font-mono text-sm font-semibold text-[#ededef]">${item.totalCost.toFixed(3)}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full bg-[#5e6ad2]" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-3 text-[11px] text-[#6b7080]">
        <span>{formatNumber(item.totalTokensIn)} in</span>
        <span>{formatNumber(item.totalTokensOut)} out</span>
      </div>
    </div>
  );
}

function BreakdownList({ items }: { items: CostBreakdownItem[] }): React.JSX.Element {
  const maxCost = items.length > 0 ? Math.max(...items.map((i) => i.totalCost)) : 0;
  if (items.length === 0) {
    return <p className="py-6 text-center text-xs text-[#6b7080]">No data for this breakdown.</p>;
  }
  return (
    <div className="space-y-4">
      {items.map((item) => <BreakdownRow key={item.name} item={item} maxCost={maxCost} />)}
    </div>
  );
}

function TemplateBreakdownList({ items }: { items: TemplateBreakdownItem[] }): React.JSX.Element {
  const maxCost = items.length > 0 ? Math.max(...items.map((i) => i.totalCost)) : 0;
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-[#6b7080]">
        No template data. Tasks must be linked to templates.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {items.map((item) => {
        const pct = maxCost > 0 ? (item.totalCost / maxCost) * 100 : 0;
        return (
          <div key={item.templateId} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#ededef]">{item.templateName ?? item.templateId}</span>
              <span className="font-mono text-sm font-semibold text-[#ededef]">${item.totalCost.toFixed(3)}</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-[#5e6ad2]" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[#6b7080]">
              <span>{item.count} tasks</span>
              <span>{formatNumber(item.totalTokensIn)} tokens</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AnalyticsContent(): React.JSX.Element {
  const [tokenSummary, setTokenSummary] = useState<TokenSummary>({ totalTokensIn: 0, totalTokensOut: 0, totalCost: 0 });
  const [byAgent, setByAgent]     = useState<CostBreakdownItem[]>([]);
  const [byModel, setByModel]     = useState<CostBreakdownItem[]>([]);
  const [byProject, setByProject] = useState<CostBreakdownItem[]>([]);
  const [byTemplate, setByTemplate] = useState<TemplateBreakdownItem[]>([]);
  const [tokenTimeline, setTokenTimeline] = useState<TimelinePoint[]>([]);
  const [costTimeline,  setCostTimeline]  = useState<TimelinePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<AnalyticsFilters | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (appliedFilters?: AnalyticsFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const apiKey = getApiKey();
      const authHeaders: Record<string, string> = {};
      if (apiKey) {
        authHeaders["x-api-key"] = apiKey;
      }

      const summaryRes = await fetch("/api/analytics/tokens", { headers: authHeaders });
      if (!summaryRes.ok) throw new Error(`Token summary: ${summaryRes.status}`);
      const summary = await summaryRes.json();

      const [agentRes, modelRes, projectRes, templateRes] = await Promise.all([
        fetch("/api/analytics/costs?groupBy=agent", { headers: authHeaders }),
        fetch("/api/analytics/costs?groupBy=model", { headers: authHeaders }),
        fetch("/api/analytics/costs?groupBy=project", { headers: authHeaders }),
        fetch("/api/analytics/costs/by-template", { headers: authHeaders }),
      ]);

      const errors: string[] = [];
      if (!agentRes.ok)    errors.push(`agent: ${agentRes.status}`);
      if (!modelRes.ok)    errors.push(`model: ${modelRes.status}`);
      if (!projectRes.ok)  errors.push(`project: ${projectRes.status}`);
      if (!templateRes.ok) errors.push(`template: ${templateRes.status}`);
      if (errors.length > 0) throw new Error(`Fetch failed: ${errors.join(", ")}`);

      const [byAgentData, byModelData, byProjectData, byTemplateData] = await Promise.all([
        agentRes.json(), modelRes.json(), projectRes.json(), templateRes.json(),
      ]);

      setTokenSummary({ totalTokensIn: summary.totalTokensIn, totalTokensOut: summary.totalTokensOut, totalCost: summary.totalCost });
      setByAgent(byAgentData);
      setByModel(byModelData);
      setByProject(byProjectData);
      setByTemplate(byTemplateData);

      if (appliedFilters) {
        const [tokRes, costRes] = await Promise.all([
          fetch(`/api/analytics/tokens/timeline?from=${appliedFilters.from}&to=${appliedFilters.to}&granularity=${appliedFilters.granularity}`, { headers: authHeaders }),
          fetch(`/api/analytics/costs/timeline?from=${appliedFilters.from}&to=${appliedFilters.to}&granularity=${appliedFilters.granularity}`, { headers: authHeaders }),
        ]);
        if (tokRes.ok)  setTokenTimeline(await tokRes.json());
        if (costRes.ok) setCostTimeline(await costRes.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch analytics");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFilterChange = (newFilters: AnalyticsFilters) => {
    setFilters(newFilters);
    fetchData(newFilters);
  };

  const agentCount = byAgent.length;
  const avgCostPerAgent = agentCount > 0 ? tokenSummary.totalCost / agentCount : 0;
  const hasData = tokenSummary.totalTokensIn > 0 || tokenSummary.totalTokensOut > 0 || tokenSummary.totalCost > 0;

  const Header = (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-[#ededef]">Analytics</h1>
      <p className="mt-0.5 text-sm text-[#6b7080]">Token usage and cost intelligence across your fleet.</p>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {Header}
        <div className="rounded-xl border border-white/8 bg-[#0d0d1a] p-6 animate-pulse">
          <div className="h-3 w-24 rounded bg-white/8" />
          <div className="mt-3 h-12 w-48 rounded bg-white/8" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-white/8 bg-[#0d0d1a] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {Header}
        <div className="flex flex-col items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/5 p-8 text-center">
          <p className="text-sm text-rose-300">Failed to load analytics data.</p>
          <p className="mt-1 text-xs text-[#6b7080]">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchData(filters ?? undefined)}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Header}

      {/* Hero: total cost */}
      <div className="rounded-xl border border-white/8 bg-[#0d0d1a] p-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b7080]/70">Total Spend</p>
        <div className="mt-2 flex items-end gap-3">
          <span className={cn(
            "text-5xl font-semibold tabular-nums tracking-tight",
            tokenSummary.totalCost === 0 ? "text-[#6b7080]" : "text-[#ededef]",
          )}>
            ${tokenSummary.totalCost.toFixed(2)}
          </span>
          {agentCount > 0 && (
            <span className="mb-2 text-sm text-[#6b7080]">
              across {agentCount} {agentCount === 1 ? "agent" : "agents"}
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-6 text-xs text-[#6b7080]">
          <span>{formatNumber(tokenSummary.totalTokensIn)} tokens in</span>
          <span>{formatNumber(tokenSummary.totalTokensOut)} tokens out</span>
          <span>${avgCostPerAgent.toFixed(4)} avg per agent</span>
        </div>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard title="Tokens In"      value={formatNumber(tokenSummary.totalTokensIn)}  icon={ArrowDownRight} description="Input tokens"        />
        <StatsCard title="Tokens Out"     value={formatNumber(tokenSummary.totalTokensOut)} icon={ArrowUpRight}   description="Output tokens"       />
        <StatsCard title="Total Cost"     value={`$${tokenSummary.totalCost.toFixed(2)}`}   icon={DollarSign}     description="All agents combined" />
        <StatsCard title="Avg / Agent"    value={`$${avgCostPerAgent.toFixed(3)}`}           icon={Users}          description={`${agentCount} agents`} />
      </div>

      {/* Filter controls */}
      <FilterControls onFilterChange={handleFilterChange} />

      {/* Timeline charts */}
      {filters && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TimelineChart
            data={tokenTimeline.map((p) => ({ timestamp: p.timestamp.split(" ")[1] || p.timestamp, value: p.tokensIn + p.tokensOut }))}
            title="Token Usage Over Time"
            color="hsl(var(--indigo))"
            formatValue={formatNumber}
          />
          <TimelineChart
            data={costTimeline.map((p) => ({ timestamp: p.timestamp.split(" ")[1] || p.timestamp, value: p.cost }))}
            title="Cost Over Time"
            color="hsl(var(--emerald))"
            formatValue={(v) => `$${v.toFixed(4)}`}
          />
        </div>
      )}

      {/* Breakdowns */}
      {!hasData ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/8 py-14 text-center">
          <DollarSign className="mb-3 h-9 w-9 text-[#6b7080]" />
          <p className="text-sm text-[#6b7080]">No usage data yet.</p>
          <p className="mt-1 text-xs text-[#6b7080]/60">Agents report token usage when completing tasks.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {([
              { label: "By Agent",   items: byAgent   },
              { label: "By Model",   items: byModel   },
              { label: "By Project", items: byProject },
            ] as const).map(({ label, items }) => (
              <Card key={label} className="py-0 gap-0">
                <CardHeader className="px-5 py-3 border-b border-white/6">
                  <CardTitle className="text-xs font-semibold uppercase tracking-widest text-[#6b7080]/70">
                    {label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <BreakdownList items={items} />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="py-0 gap-0">
            <CardHeader className="px-5 py-3 border-b border-white/6">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-[#6b7080]/70">
                By Task Template
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <TemplateBreakdownList items={byTemplate} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
