"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  DollarSign,
  Loader2,
  RefreshCw,
  TriangleAlert,
  Users,
} from "lucide-react";
import type { TokenSummary } from "@/lib/types";
import { StatsCard } from "@/components/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TimelineChart } from "@/components/analytics/timeline-chart";
import { FilterControls, type AnalyticsFilters } from "@/components/analytics/filter-controls";
import { cn } from "@/lib/utils";

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

interface TokenTimelinePoint {
  timestamp: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  count: number;
}

interface CostTimelinePoint {
  timestamp: string;
  totalCost: number;
  tokensIn: number;
  tokensOut: number;
  count: number;
}

interface SyncState {
  status: "idle" | "syncing" | "success" | "failed" | "skipped";
  message: string;
  completedAt: string | null;
}

interface UnsupportedBreakdowns {
  project: boolean;
  template: boolean;
}

function getDefaultAnalyticsFilters(): AnalyticsFilters {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    granularity: "day",
  };
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatSyncTimestamp(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString();
}

function BreakdownRow({ item, maxCost }: { item: CostBreakdownItem; maxCost: number }): React.JSX.Element {
  const pct = maxCost > 0 ? (item.totalCost / maxCost) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm text-[#ededef]">{item.name}</span>
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

function BreakdownList({
  items,
  unsupported = false,
}: {
  items: CostBreakdownItem[];
  unsupported?: boolean;
}): React.JSX.Element {
  if (unsupported) {
    return (
      <p className="py-6 text-center text-xs text-[#6b7080]">
        This breakdown is not available yet for imported OpenClaw session usage.
      </p>
    );
  }

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

function TemplateBreakdownList({
  items,
  unsupported = false,
}: {
  items: TemplateBreakdownItem[];
  unsupported?: boolean;
}): React.JSX.Element {
  if (unsupported) {
    return (
      <p className="py-6 text-center text-xs text-[#6b7080]">
        Task template cost attribution has not been mapped from imported session usage yet.
      </p>
    );
  }

  const maxCost = items.length > 0 ? Math.max(...items.map((i) => i.totalCost)) : 0;
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-[#6b7080]">
        No template data has been imported yet.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {items.map((item) => {
        const pct = maxCost > 0 ? (item.totalCost / maxCost) * 100 : 0;
        return (
          <div key={item.templateId} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm text-[#ededef]">{item.templateName ?? item.templateId}</span>
              <span className="font-mono text-sm font-semibold text-[#ededef]">${item.totalCost.toFixed(3)}</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-[#5e6ad2]" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[#6b7080]">
              <span>{item.count} rows</span>
              <span>{formatNumber(item.totalTokensIn)} tokens</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SyncStatusBanner({
  syncState,
  onSync,
  isSyncing,
}: {
  syncState: SyncState;
  onSync: () => void;
  isSyncing: boolean;
}): React.JSX.Element {
  const formattedTimestamp = formatSyncTimestamp(syncState.completedAt);

  if (syncState.status === "idle") {
    return (
      <div className="flex items-center justify-between rounded-xl border border-white/8 bg-[#0d0d1a] px-4 py-3">
        <p className="text-sm text-[#6b7080]">Analytics will sync imported OpenClaw usage before loading.</p>
        <Button variant="outline" size="sm" onClick={onSync} disabled={isSyncing} className="gap-2">
          {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync Now
        </Button>
      </div>
    );
  }

  const toneClass =
    syncState.status === "failed"
      ? "border-rose-500/20 bg-rose-500/5 text-rose-200"
      : syncState.status === "syncing"
        ? "border-sky-500/20 bg-sky-500/5 text-sky-200"
        : "border-emerald-500/20 bg-emerald-500/5 text-emerald-200";
  const Icon =
    syncState.status === "failed"
      ? TriangleAlert
      : syncState.status === "syncing"
        ? Loader2
        : CheckCircle2;

  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between", toneClass)}>
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", syncState.status === "syncing" ? "animate-spin" : "")} />
        <div>
          <p className="text-sm font-medium">{syncState.message}</p>
          {formattedTimestamp ? (
            <p className="mt-0.5 text-xs text-current/70">Last completed: {formattedTimestamp}</p>
          ) : null}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onSync} disabled={isSyncing} className="gap-2 self-start sm:self-auto">
        {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Sync Now
      </Button>
    </div>
  );
}

export function AnalyticsContent(): React.JSX.Element {
  const [tokenSummary, setTokenSummary] = useState<TokenSummary>({ totalTokensIn: 0, totalTokensOut: 0, totalCost: 0 });
  const [byAgent, setByAgent] = useState<CostBreakdownItem[]>([]);
  const [byModel, setByModel] = useState<CostBreakdownItem[]>([]);
  const [byProject, setByProject] = useState<CostBreakdownItem[]>([]);
  const [byTemplate, setByTemplate] = useState<TemplateBreakdownItem[]>([]);
  const [tokenTimeline, setTokenTimeline] = useState<TokenTimelinePoint[]>([]);
  const [costTimeline, setCostTimeline] = useState<CostTimelinePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [filters, setFilters] = useState<AnalyticsFilters>(getDefaultAnalyticsFilters);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({
    status: "idle",
    message: "Preparing analytics sync.",
    completedAt: null,
  });
  const [unsupportedBreakdowns, setUnsupportedBreakdowns] = useState<UnsupportedBreakdowns>({
    project: false,
    template: false,
  });
  const hasBootstrappedRef = useRef(false);

  const fetchData = useCallback(async (appliedFilters: AnalyticsFilters): Promise<void> => {
    const summaryRes = await fetch(
      `/api/analytics/tokens?from=${encodeURIComponent(appliedFilters.from)}&to=${encodeURIComponent(appliedFilters.to)}`,
    );
    if (!summaryRes.ok) {
      throw new Error(`Token summary: ${summaryRes.status}`);
    }

    const summary = await summaryRes.json() as {
      totalTokensIn: number;
      totalTokensOut: number;
      totalCost: number;
    };

    const [agentRes, modelRes, projectRes, templateRes, tokenTimelineRes, costTimelineRes] = await Promise.all([
      fetch("/api/analytics/costs?groupBy=agent"),
      fetch("/api/analytics/costs?groupBy=model"),
      fetch("/api/analytics/costs?groupBy=project"),
      fetch("/api/analytics/costs/by-template"),
      fetch(`/api/analytics/tokens/timeline?from=${encodeURIComponent(appliedFilters.from)}&to=${encodeURIComponent(appliedFilters.to)}&granularity=${appliedFilters.granularity}`),
      fetch(`/api/analytics/costs/timeline?from=${encodeURIComponent(appliedFilters.from)}&to=${encodeURIComponent(appliedFilters.to)}&granularity=${appliedFilters.granularity}`),
    ]);

    const projectUnsupported = projectRes.status === 501;
    const templateUnsupported = templateRes.status === 501;
    const failed: string[] = [];
    if (!agentRes.ok) failed.push(`agent: ${agentRes.status}`);
    if (!modelRes.ok) failed.push(`model: ${modelRes.status}`);
    if (!projectRes.ok && !projectUnsupported) failed.push(`project: ${projectRes.status}`);
    if (!templateRes.ok && !templateUnsupported) failed.push(`template: ${templateRes.status}`);
    if (!tokenTimelineRes.ok) failed.push(`token timeline: ${tokenTimelineRes.status}`);
    if (!costTimelineRes.ok) failed.push(`cost timeline: ${costTimelineRes.status}`);

    if (failed.length > 0) {
      throw new Error(`Fetch failed: ${failed.join(", ")}`);
    }

    const [
      byAgentData,
      byModelData,
      byProjectData,
      byTemplateData,
      tokenTimelineData,
      costTimelineData,
    ] = await Promise.all([
      agentRes.json() as Promise<CostBreakdownItem[]>,
      modelRes.json() as Promise<CostBreakdownItem[]>,
      projectUnsupported ? Promise.resolve([]) : projectRes.json() as Promise<CostBreakdownItem[]>,
      templateUnsupported ? Promise.resolve([]) : templateRes.json() as Promise<TemplateBreakdownItem[]>,
      tokenTimelineRes.json() as Promise<TokenTimelinePoint[]>,
      costTimelineRes.json() as Promise<CostTimelinePoint[]>,
    ]);

    setTokenSummary(summary);
    setByAgent(byAgentData);
    setByModel(byModelData);
    setByProject(byProjectData);
    setByTemplate(byTemplateData);
    setTokenTimeline(tokenTimelineData);
    setCostTimeline(costTimelineData);
    setUnsupportedBreakdowns({
      project: projectUnsupported,
      template: templateUnsupported,
    });
  }, []);

  const runSync = useCallback(async (): Promise<void> => {
    setIsSyncing(true);
    setSyncState({
      status: "syncing",
      message: "Syncing OpenClaw sessions and imported usage...",
      completedAt: syncState.completedAt,
    });

    try {
      const response = await fetch("/api/sync/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: "full" }),
      });

      const data = await response.json() as {
        error?: string;
        code?: string;
        completedAt?: string;
      };

      if (!response.ok) {
        if (response.status === 404 && data.code === "NO_CONNECTION") {
          setSyncState({
            status: "skipped",
            message: "No OpenClaw connection found. Analytics is showing the latest imported data available.",
            completedAt: null,
          });
          return;
        }

        throw new Error(data.error || "Failed to sync OpenClaw usage.");
      }

      setSyncState({
        status: "success",
        message: "OpenClaw sync completed. Analytics reflects the latest imported session usage.",
        completedAt: data.completedAt ?? new Date().toISOString(),
      });
    } catch (err) {
      setSyncState({
        status: "failed",
        message: err instanceof Error ? err.message : "Failed to sync OpenClaw usage.",
        completedAt: syncState.completedAt,
      });
    } finally {
      setIsSyncing(false);
    }
  }, [syncState.completedAt]);

  const loadAnalytics = useCallback(async (appliedFilters: AnalyticsFilters, withSync: boolean): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      if (withSync) {
        await runSync();
      }

      await fetchData(appliedFilters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch analytics");
    } finally {
      setIsLoading(false);
    }
  }, [fetchData, runSync]);

  useEffect(() => {
    if (hasBootstrappedRef.current) {
      return;
    }

    hasBootstrappedRef.current = true;
    void loadAnalytics(filters, true);
  }, [filters, loadAnalytics]);

  const handleFilterChange = useCallback((newFilters: AnalyticsFilters) => {
    setFilters(newFilters);
    void loadAnalytics(newFilters, false);
  }, [loadAnalytics]);

  const handleManualSync = useCallback(() => {
    void loadAnalytics(filters, true);
  }, [filters, loadAnalytics]);

  const agentCount = byAgent.length;
  const avgCostPerAgent = agentCount > 0 ? tokenSummary.totalCost / agentCount : 0;
  const hasData = tokenSummary.totalTokensIn > 0 || tokenSummary.totalTokensOut > 0 || tokenSummary.totalCost > 0;

  const Header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#ededef]">Analytics</h1>
        <p className="mt-0.5 text-sm text-[#6b7080]">Imported OpenClaw session usage across your fleet.</p>
      </div>
      <Button variant="outline" size="sm" onClick={handleManualSync} disabled={isLoading || isSyncing} className="gap-2 self-start">
        {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Sync Now
      </Button>
    </div>
  );

  if (isLoading && !hasData) {
    return (
      <div className="space-y-6">
        {Header}
        <SyncStatusBanner syncState={syncState} onSync={handleManualSync} isSyncing={isSyncing} />
        <div className="rounded-xl border border-white/8 bg-[#0d0d1a] p-6 animate-pulse">
          <div className="h-3 w-24 rounded bg-white/8" />
          <div className="mt-3 h-12 w-48 rounded bg-white/8" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-white/8 bg-[#0d0d1a] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !hasData) {
    return (
      <div className="space-y-6">
        {Header}
        <SyncStatusBanner syncState={syncState} onSync={handleManualSync} isSyncing={isSyncing} />
        <div className="flex flex-col items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/5 p-8 text-center">
          <p className="text-sm text-rose-300">Failed to load analytics data.</p>
          <p className="mt-1 text-xs text-[#6b7080]">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={handleManualSync}>
            Retry Sync
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Header}
      <SyncStatusBanner syncState={syncState} onSync={handleManualSync} isSyncing={isSyncing} />

      {error ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100">
          Showing the latest loaded analytics snapshot. Refresh failed: {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-white/8 bg-[#0d0d1a] p-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b7080]/70">Total Spend</p>
        <div className="mt-2 flex items-end gap-3">
          <span className={cn(
            "text-5xl font-semibold tabular-nums tracking-tight",
            tokenSummary.totalCost === 0 ? "text-[#6b7080]" : "text-[#ededef]",
          )}>
            ${tokenSummary.totalCost.toFixed(2)}
          </span>
          {agentCount > 0 ? (
            <span className="mb-2 text-sm text-[#6b7080]">
              across {agentCount} {agentCount === 1 ? "agent" : "agents"}
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-6 text-xs text-[#6b7080]">
          <span>{formatNumber(tokenSummary.totalTokensIn)} tokens in</span>
          <span>{formatNumber(tokenSummary.totalTokensOut)} tokens out</span>
          <span>${avgCostPerAgent.toFixed(4)} avg per agent</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Tokens In" value={formatNumber(tokenSummary.totalTokensIn)} icon={ArrowDownRight} description="Input tokens" />
        <StatsCard title="Tokens Out" value={formatNumber(tokenSummary.totalTokensOut)} icon={ArrowUpRight} description="Output tokens" />
        <StatsCard title="Total Cost" value={`$${tokenSummary.totalCost.toFixed(2)}`} icon={DollarSign} description="All agents combined" />
        <StatsCard title="Avg / Agent" value={`$${avgCostPerAgent.toFixed(3)}`} icon={Users} description={`${agentCount} agents`} />
      </div>

      <FilterControls onFilterChange={handleFilterChange} initialFilters={filters} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TimelineChart
          data={tokenTimeline.map((p) => ({ timestamp: p.timestamp.split(" ")[1] || p.timestamp, value: p.tokensIn + p.tokensOut }))}
          title="Token Usage Over Time"
          color="hsl(var(--indigo))"
          formatValue={formatNumber}
        />
        <TimelineChart
          data={costTimeline.map((p) => ({ timestamp: p.timestamp.split(" ")[1] || p.timestamp, value: p.totalCost }))}
          title="Cost Over Time"
          color="hsl(var(--emerald))"
          formatValue={(v) => `$${v.toFixed(4)}`}
        />
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/8 py-14 text-center">
          <DollarSign className="mb-3 h-9 w-9 text-[#6b7080]" />
          <p className="text-sm text-[#6b7080]">No imported usage data yet.</p>
          <p className="mt-1 text-xs text-[#6b7080]/60">OpenClaw session usage is imported during sync.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {([
              { label: "By Agent", items: byAgent },
              { label: "By Model", items: byModel },
              { label: "By Project", items: byProject },
            ] as const).map(({ label, items }) => (
              <Card key={label} className="gap-0 py-0">
                <CardHeader className="border-b border-white/6 px-5 py-3">
                  <CardTitle className="text-xs font-semibold uppercase tracking-widest text-[#6b7080]/70">
                    {label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <BreakdownList items={items} unsupported={label === "By Project" && unsupportedBreakdowns.project} />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b border-white/6 px-5 py-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-[#6b7080]/70">
                By Task Template
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <TemplateBreakdownList items={byTemplate} unsupported={unsupportedBreakdowns.template} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
