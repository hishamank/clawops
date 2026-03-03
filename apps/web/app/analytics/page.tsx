import { ArrowDownRight, ArrowUpRight, DollarSign, Users } from "lucide-react";
import { api } from "@/lib/api";
import type { TokenSummary } from "@/lib/types";
import { StatsCard } from "@/components/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CostBreakdownItem {
  name: string;
  totalCost: number;
  totalTokensIn: number;
  totalTokensOut: number;
}

async function getTokenSummary(): Promise<TokenSummary> {
  try {
    return await api<TokenSummary>("/analytics/tokens", { tags: ["analytics"] });
  } catch {
    return { totalTokensIn: 0, totalTokensOut: 0, totalCost: 0 };
  }
}

async function getCostBreakdown(groupBy: string): Promise<CostBreakdownItem[]> {
  try {
    return await api<CostBreakdownItem[]>(`/analytics/costs?groupBy=${groupBy}`, {
      tags: ["analytics"],
    });
  } catch {
    return [];
  }
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

export default async function AnalyticsPage(): Promise<React.JSX.Element> {
  const [tokenSummary, byAgent, byModel, byProject] = await Promise.all([
    getTokenSummary(),
    getCostBreakdown("agent"),
    getCostBreakdown("model"),
    getCostBreakdown("project"),
  ]);

  const agentCount = byAgent.length || 1;
  const avgCostPerAgent = tokenSummary.totalCost / agentCount;
  const hasData =
    tokenSummary.totalTokensIn > 0 ||
    tokenSummary.totalTokensOut > 0 ||
    tokenSummary.totalCost > 0;

  const tabs = [
    { label: "By Agent", items: byAgent },
    { label: "By Model", items: byModel },
    { label: "By Project", items: byProject },
  ] as const;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Token usage and cost intelligence across your fleet.
        </p>
      </div>

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
      )}
    </div>
  );
}
