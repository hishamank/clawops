import { getAgent, getAgentRuns } from "@/lib/api";
import type { Agent, Run } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/card";
import { Badge } from "@/components/badge";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let agent: Agent | null = null;
  let runs: Run[] = [];
  let error: string | null = null;

  try {
    [agent, runs] = await Promise.all([getAgent(id), getAgentRuns(id)]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to fetch agent";
  }

  if (error || !agent) {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">Agent Not Found</h1>
        <Card className="border-red-900">
          <CardContent className="p-4">
            <p className="text-sm text-red-400">{error ?? "Agent not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{agent.name}</h1>
          <p className="font-mono text-sm text-muted-foreground">{agent.id}</p>
        </div>
        <Badge variant={agent.status} className="text-sm">
          {agent.status}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={agent.status}>{agent.status}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last Seen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {new Date(agent.lastSeen).toLocaleString()}
            </p>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run History</CardTitle>
          <CardDescription>All runs for this agent</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet</p>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="rounded-md border border-border p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{run.task}</p>
                    <Badge variant={run.status}>{run.status}</Badge>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>
                      Started: {new Date(run.startedAt).toLocaleString()}
                    </span>
                    {run.finishedAt && (
                      <span>
                        Finished: {new Date(run.finishedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {run.output && (
                    <pre className="mt-2 rounded bg-secondary p-2 text-xs">
                      {run.output}
                    </pre>
                  )}
                  {run.error && (
                    <pre className="mt-2 rounded bg-red-950 p-2 text-xs text-red-300">
                      {run.error}
                    </pre>
                  )}
                  <p className="font-mono text-xs text-muted-foreground">
                    {run.id}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
