import Link from "next/link";
import { getRuns } from "@/lib/api";
import type { Run } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";
import { Badge } from "@/components/badge";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string; status?: string; page?: string }>;
}) {
  const { agent, status, page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  let runs: Run[] = [];
  let error: string | null = null;

  try {
    runs = await getRuns({ agent, status });
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to fetch runs";
  }

  const totalPages = Math.max(1, Math.ceil(runs.length / PAGE_SIZE));
  const paginatedRuns = runs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const statuses = ["pending", "running", "completed", "failed"] as const;

  function buildUrl(params: Record<string, string | undefined>) {
    const search = new URLSearchParams();
    if (params.status) search.set("status", params.status);
    if (params.agent) search.set("agent", params.agent);
    if (params.page && params.page !== "1") search.set("page", params.page);
    const qs = search.toString();
    return `/runs${qs ? `?${qs}` : ""}`;
  }

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
          href={buildUrl({ agent })}
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
            href={buildUrl({ status: s, agent })}
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
            <p className="text-sm text-muted-foreground">
              No runs yet. Use the CLI to start one:
              <code className="ml-2 text-foreground">
                clawops run start --agent &lt;id&gt; --task &quot;my task&quot;
              </code>
            </p>
          ) : (
            <div className="space-y-3">
              {paginatedRuns.map((run) => (
                <div
                  key={run.id}
                  className="rounded-md border border-border p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{run.task}</p>
                    <Badge variant={run.status}>{run.status}</Badge>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <Link
                      href={`/agents/${run.agentId}`}
                      className="hover:text-foreground transition-colors"
                    >
                      Agent: {run.agentId}
                    </Link>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <a
              href={buildUrl({
                status,
                agent,
                page: String(currentPage - 1),
              })}
              className="rounded-md bg-secondary px-3 py-1 text-sm transition-colors hover:bg-secondary/80"
            >
              Previous
            </a>
          )}
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages && (
            <a
              href={buildUrl({
                status,
                agent,
                page: String(currentPage + 1),
              })}
              className="rounded-md bg-secondary px-3 py-1 text-sm transition-colors hover:bg-secondary/80"
            >
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}
