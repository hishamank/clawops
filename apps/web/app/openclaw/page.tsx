import type { Metadata } from "next";
import { Activity, Plug, Clock4 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/stats-card";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import { getDb } from "@/lib/server/runtime";
import {
  listOpenClawConnections,
  listSyncRuns,
  listOpenClawSessions,
  type OpenClawSessionRecord,
  type SyncRunSummary,
} from "@clawops/sync";
import { listCronJobs } from "@clawops/habits";
import { desc, eq, workspaceFiles, type WorkspaceFile } from "@clawops/core";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "OpenClaw",
  description: "Operator dashboard for OpenClaw connections, sync runs, and telemetry",
};

function renderTimeAgo(value?: Date | null): string {
  return timeAgo(value ? value.toISOString() : null);
}

const syncStatusStyles: Record<string, string> = {
  success: "text-emerald-500",
  failed: "text-rose-500",
  running: "text-indigo-500",
};

const connectionStatusStyles: Record<string, string> = {
  active: "text-emerald-500 focus:text-emerald-500",
  disconnected: "text-amber-500 focus:text-amber-500",
  error: "text-rose-500 focus:text-rose-500",
};

const sessionStatusStyles: Record<string, string> = {
  active: "text-emerald-500",
  ended: "text-muted-foreground",
};

async function fetchPageData() {
  const db = getDb();
  const connections = listOpenClawConnections(db);
  const syncRuns: SyncRunSummary[] = listSyncRuns(db, 6);
  const sessions: OpenClawSessionRecord[] = listOpenClawSessions(db, { limit: 6 });
  const latestConnection = connections[0] ?? null;
  const cronJobs = latestConnection
    ? listCronJobs(db, { connectionId: latestConnection.id }).slice(0, 5)
    : [];
  const trackedFiles = latestConnection
    ? db
        .select()
        .from(workspaceFiles)
        .where(eq(workspaceFiles.connectionId, latestConnection.id))
        .orderBy(desc(workspaceFiles.lastSeenAt))
        .limit(5)
        .all()
    : ([] as WorkspaceFile[]);

  return {
    connections,
    syncRuns,
    sessions,
    cronJobs,
    trackedFiles,
  };
}

export default async function OpenClawPage(): Promise<React.JSX.Element> {
  const { connections, syncRuns, sessions, cronJobs, trackedFiles } = await fetchPageData();
  const latestConnection = connections[0] ?? null;
  const latestRun = syncRuns[0] ?? null;
  const activeSessions = sessions.filter((session) => session.status === "active").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">OpenClaw</h1>
        <p className="mt-1 text-muted-foreground">
          Monitor connections, syncs, sessions, cron jobs, and tracked files.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatsCard
          title="Connections"
          value={connections.length}
          icon={Plug}
          description="Configured OpenClaw roots"
        />
        <StatsCard
          title="Active Sessions"
          value={activeSessions}
          icon={Activity}
          description="Live agent sessions"
        />
        <StatsCard
          title="Latest Sync"
          value={latestRun ? latestRun.status : "n/a"}
          icon={Clock4}
          description={
            latestRun
              ? `${renderTimeAgo(latestRun.startedAt)} · ${latestRun.syncType}`
              : "No syncs executed yet"
          }
        />
      </div>

      <section className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Connections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {connections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No OpenClaw connections yet. Run onboarding or sync to register a connection.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {connections.map((connection) => {
                  let gatewayDisplay: string | null = null;
                  if (connection.gatewayUrl) {
                    try {
                      gatewayDisplay = new URL(connection.gatewayUrl).host;
                    } catch {
                      gatewayDisplay = connection.gatewayUrl;
                    }
                  }

                  return (
                    <div
                      key={connection.id}
                      className="rounded-xl border border-border p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-sidebar-foreground">
                          {connection.name}
                        </h3>
                        <Badge
                          variant="outline"
                          className={cn(
                            connectionStatusStyles[connection.status] ?? "text-muted-foreground",
                            "text-xs capitalize"
                          )}
                        >
                          {connection.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{connection.rootPath}</p>
                      {gatewayDisplay && (
                        <p className="text-xs text-muted-foreground">{gatewayDisplay}</p>
                      )}
                      <div className="mt-2 text-xs text-muted-foreground">
                        {connection.lastSyncedAt
                          ? `Last synced ${renderTimeAgo(connection.lastSyncedAt)}`
                          : "Never synced yet"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sync runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {latestRun ? (
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Latest run</p>
                    <p className="text-sm font-semibold">{latestRun.status}</p>
                  </div>
                  <span
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wide",
                      syncStatusStyles[latestRun.status] ?? "text-muted-foreground"
                    )}
                  >
                    {latestRun.syncType}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {latestRun.completedAt
                    ? `Completed ${renderTimeAgo(latestRun.completedAt)}`
                    : `Started ${renderTimeAgo(latestRun.startedAt)}`}
                </p>
                <div className="mt-2 text-xs text-muted-foreground">
                  {latestRun.agentCount} agents · {latestRun.cronJobCount} cron jobs ·{" "}
                  {latestRun.workspaceCount} workspaces
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No sync runs recorded yet. Trigger OpenClaw sync to populate runs.
              </p>
            )}

            <div className="space-y-3">
              {syncRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{run.syncType}</p>
                    <p className="text-xs text-muted-foreground">{renderTimeAgo(run.startedAt)}</p>
                  </div>
                  <span
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wide",
                      syncStatusStyles[run.status] ?? "text-muted-foreground"
                    )}
                  >
                    {run.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No sessions recorded yet. Once OpenClaw syncs run, active sessions appear
                here.
              </p>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">{session.sessionKey}</p>
                      <p className="text-xs text-muted-foreground">
                        {session.agentId ?? "Unassigned"} · {session.model ?? "−"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-xs font-semibold uppercase tracking-wide",
                        sessionStatusStyles[session.status] ?? "text-muted-foreground"
                      )}
                    >
                      {session.status}
                    </span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  {activeSessions} sessions are currently active.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cron jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cronJobs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No cron jobs synced yet. Run "Sync cron jobs" after connecting a gateway.
              </p>
            ) : (
              <div className="space-y-3">
                {cronJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-semibold">{job.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.scheduleKind} · {job.scheduleExpr ?? "raw"}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        job.enabled ? "text-emerald-500" : "text-rose-500",
                        "text-xs uppercase"
                      )}
                    >
                      {job.enabled ? "Enabled" : "Paused"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tracked files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!latestConnection ? (
              <p className="text-xs text-muted-foreground">
                Connect OpenClaw to start tracking workspace files.
              </p>
            ) : trackedFiles.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No tracked files yet for the latest connection.
              </p>
            ) : (
              <div className="space-y-3">
                {trackedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">{file.relativePath}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.workspacePath} · {renderTimeAgo(file.lastSeenAt)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {file.sizeBytes != null ? `${file.sizeBytes} bytes` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
