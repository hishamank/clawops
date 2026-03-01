import Link from "next/link";
import { getAgents, getRuns } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";
import { Badge } from "@/components/badge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let agents: Awaited<ReturnType<typeof getAgents>> = [];
  let runs: Awaited<ReturnType<typeof getRuns>> = [];
  let error: string | null = null;

  try {
    [agents, runs] = await Promise.all([getAgents(), getRuns()]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to fetch data";
  }

  const onlineCount = agents.filter((a) => a.status === "online").length;
  const runningCount = runs.filter((r) => r.status === "running").length;
  const recentRuns = runs.slice(0, 10);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Agent operations overview
        </p>
      </div>

      {error && (
        <Card className="border-red-900">
          <CardContent className="p-4">
            <p className="text-sm text-red-400">
              Could not connect to API: {error}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agents.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Online
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">
              {onlineCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Running
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">
              {runningCount}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet</p>
          ) : (
            <div className="space-y-3">
              {recentRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between rounded-md border border-border p-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{run.task}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(run.startedAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={run.status}>{run.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agents</CardTitle>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agents registered</p>
          ) : (
            <div className="space-y-3">
              {agents.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.id}`}
                  className="flex items-center justify-between rounded-md border border-border p-3 transition-colors hover:bg-secondary"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Last seen: {new Date(agent.lastSeen).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={agent.status}>{agent.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
