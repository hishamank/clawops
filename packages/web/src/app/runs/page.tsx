import { getRuns } from "@/lib/api";
import type { Run } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";
import { Badge } from "@/components/badge";

export const dynamic = "force-dynamic";

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string; status?: string }>;
}) {
  const { agent, status } = await searchParams;
  let runs: Run[] = [];
  let error: string | null = null;

  try {
    runs = await getRuns({ agent, status });
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to fetch runs";
  }

  const statuses = ["pending", "running", "completed", "failed"] as const;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Runs</h1>
        <p className="text-muted-foreground">All agent runs</p>
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

      <div className="flex gap-2">
        <a
          href="/runs"
          className={`rounded-md px-3 py-1 text-sm transition-colors ${
            !status
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary"
          }`}
        >
          All
        </a>
        {statuses.map((s) => (
          <a
            key={s}
            href={`/runs?status=${s}${agent ? `&agent=${agent}` : ""}`}
            className={`rounded-md px-3 py-1 text-sm transition-colors ${
              status === s
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </a>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {runs.length} {runs.length === 1 ? "run" : "runs"}
            {status ? ` (${status})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs found</p>
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
                    <span>Agent: {run.agentId}</span>
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
