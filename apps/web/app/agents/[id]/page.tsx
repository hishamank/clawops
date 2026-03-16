import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  Zap,
  Radio,
  Timer,
  MessageSquare,
  Activity,
  ArrowUpRight,
  ArrowDownLeft,
  Link2,
  AlertCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import Link from "next/link";
import type {
  Agent,
  Task,
  Habit,
  HabitStreak,
  Artifact,
  OpenClawSession,
  AgentMessage,
  ActivityEvent,
  OpenClawMapping,
} from "@/lib/types";
import { timeAgo } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskList } from "@/components/tasks/task-list";
import { cn } from "@/lib/utils";
import { getAgent as getAgentById, getOpenClawMappingByAgentId } from "@clawops/agents";
import { listTasks, getTask } from "@clawops/tasks";
import { listHabits, getHabitStreak, listCronJobs } from "@clawops/habits";
import {
  openclawSessions,
  agentMessages,
  activityEvents,
  syncRuns,
  eq,
  or,
  and,
  desc,
  type SyncRun,
} from "@clawops/core";
import { getDb } from "@/lib/server/runtime";
import { PanelEmptyState } from "@/components/agents/panel-empty-state";
import { PanelErrorState } from "@/components/agents/panel-error-state";

export const dynamic = "force-dynamic";

interface AgentDetailResponse extends Agent {
  recentTasks?: Task[];
  habits?: (Habit & { streaks?: HabitStreak[] })[];
  sessions?: OpenClawSession[];
  cronJobs?: Habit[];
  messages?: AgentMessage[];
  activity?: ActivityEvent[];
  openclawMapping?: OpenClawMapping | null;
  syncStatus?: SyncRun | null;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

const statusColors: Record<Agent["status"], string> = {
  online: "bg-emerald-500",
  busy: "bg-amber-500",
  idle: "bg-amber-500",
  offline: "bg-zinc-500",
};

const statusLabels: Record<Agent["status"], string> = {
  online: "Active",
  busy: "Busy",
  idle: "Idle",
  offline: "Offline",
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function parseSkills(skills: string | null): string[] {
  if (!skills) return [];
  try {
    const parsed: unknown = JSON.parse(skills);
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
    return [];
  } catch {
    return skills.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

function formatDuration(
  startedAt: string | Date,
  endedAt: string | Date | null,
): string {
  if (!endedAt) return "active";
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

async function getAgent(id: string): Promise<AgentDetailResponse | null> {
  const db = getDb();
  const agent = getAgentById(db, id);
  if (!agent) return null;

  const recentTasks = listTasks(db, { assigneeId: id }).slice(0, 10);
  const habits = listHabits(db, id).map((h) => ({
    ...h,
    streaks: getHabitStreak(db, h.id, 7) as HabitStreak[],
  }));

  // OpenClaw mapping
  const openclawMapping = getOpenClawMappingByAgentId(db, id) as OpenClawMapping | null;

  // Sessions — scoped to connection + external agent ID
  let sessions: OpenClawSession[] = [];
  if (openclawMapping) {
    sessions = db
      .select()
      .from(openclawSessions)
      .where(
        and(
          eq(openclawSessions.connectionId, openclawMapping.connectionId),
          eq(openclawSessions.agentId, openclawMapping.externalAgentId),
        ),
      )
      .orderBy(desc(openclawSessions.updatedAt))
      .limit(10)
      .all() as OpenClawSession[];
  }

  // Cron jobs — habits of type "cron" for this agent
  const cronJobs = listCronJobs(db).filter((h) => h.agentId === id) as Habit[];

  // Messages — sent or received by this agent's external ID
  let messages: AgentMessage[] = [];
  if (openclawMapping) {
    messages = db
      .select()
      .from(agentMessages)
      .where(
        or(
          eq(agentMessages.fromAgentId, openclawMapping.externalAgentId),
          eq(agentMessages.toAgentId, openclawMapping.externalAgentId),
        ),
      )
      .orderBy(desc(agentMessages.sentAt))
      .limit(10)
      .all() as AgentMessage[];
  }

  // Activity events
  const activity = db
    .select()
    .from(activityEvents)
    .where(eq(activityEvents.agentId, id))
    .orderBy(desc(activityEvents.createdAt))
    .limit(15)
    .all() as ActivityEvent[];

  // Sync status — get latest sync run for this connection
  let syncStatus: SyncRun | null = null;
  if (openclawMapping) {
    const latestSync = db
      .select()
      .from(syncRuns)
      .where(eq(syncRuns.connectionId, openclawMapping.connectionId))
      .orderBy(desc(syncRuns.startedAt))
      .limit(1)
      .get() as SyncRun | undefined;
    syncStatus = latestSync ?? null;
  }

  return {
    ...agent,
    recentTasks,
    habits,
    sessions,
    cronJobs,
    messages,
    activity,
    openclawMapping,
    syncStatus,
  } as unknown as AgentDetailResponse;
}

async function getAgentTasks(id: string): Promise<Task[]> {
  return listTasks(getDb(), { assigneeId: id }) as unknown as Task[];
}

async function getAgentArtifacts(tasks: Task[]): Promise<Artifact[]> {
  const doneTasks = tasks.filter((t) => t.status === "done");
  if (doneTasks.length === 0) return [];

  const results = await Promise.all(
    doneTasks.slice(0, 5).map(async (task) => {
      try {
        const taskDetail = getTask(getDb(), task.id) as unknown as Task & { artifacts?: Artifact[] };
        return taskDetail.artifacts ?? [];
      } catch {
        return [];
      }
    })
  );
  return results.flat();
}

function StreakDots({ streaks }: { streaks?: HabitStreak[] }): React.JSX.Element {
  const dots = Array.from({ length: 7 }, (_, i) => {
    const streak = streaks?.[i];
    if (!streak) return "bg-muted";
    return streak.ran
      ? streak.success
        ? "bg-emerald-500"
        : "bg-rose-500"
      : "bg-muted";
  });

  return (
    <div className="flex items-center gap-1">
      {dots.map((color, i) => (
        <div key={i} className={cn("h-3 w-3 rounded-sm", color)} />
      ))}
    </div>
  );
}

const severityIcons = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  critical: AlertCircle,
} as const;

export default async function AgentProfile({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const agent = await getAgent(id);

  if (!agent) {
    notFound();
  }

  const tasks = agent.recentTasks ?? (await getAgentTasks(id));
  const habits = agent.habits ?? [];
  const skills = parseSkills(agent.skills);
  const artifacts = await getAgentArtifacts(tasks);
  const sessions = agent.sessions ?? [];
  const cronJobs = agent.cronJobs ?? [];
  const messages = agent.messages ?? [];
  const activity = agent.activity ?? [];
  const openclawMapping = agent.openclawMapping ?? null;
  const syncStatus = agent.syncStatus ?? null;

  const hasOpenClawLink = openclawMapping !== null;
  const hasSyncRun = syncStatus !== null;
  const syncFailed = syncStatus?.status === "failed";

  const completedTasks = tasks.filter((t) => t.status === "done");
  const completionRate =
    tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Fleet
      </Link>

      {/* Identity Strip */}
      <div className="flex items-start gap-6">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-2xl">
          {agent.avatar ?? getInitials(agent.name)}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {agent.name}
            </h1>
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  statusColors[agent.status]
                )}
              />
              <span className="text-sm text-muted-foreground">
                {statusLabels[agent.status]}
              </span>
            </div>
          </div>
          <p className="text-muted-foreground">{agent.role}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{agent.model}</Badge>
            {agent.framework && (
              <Badge variant="outline">{agent.framework}</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              Active {timeAgo(agent.lastActive)}
            </span>
          </div>
        </div>
      </div>

      {/* OpenClaw Integration Bar */}
      {openclawMapping && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
          <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <span className="text-muted-foreground">
              Linked to{" "}
              <span className="font-medium text-foreground">
                {openclawMapping.externalAgentName}
              </span>
            </span>
            {openclawMapping.workspacePath && (
              <>
                <span className="text-muted-foreground">·</span>
                <code className="text-xs text-muted-foreground">
                  {openclawMapping.workspacePath}
                </code>
              </>
            )}
            {openclawMapping.lastSeenAt && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">
                  Last seen {timeAgo(openclawMapping.lastSeenAt)}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Knowledge Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Knowledge</CardTitle>
        </CardHeader>
        <CardContent>
          {agent.memoryPath ? (
            <p className="text-sm text-muted-foreground">
              Memory files at <code className="text-primary text-xs">{agent.memoryPath}</code>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No memory path configured. Set one via{" "}
              <code className="text-primary text-xs">clawops agent init --memory-path &lt;path&gt;</code>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Skills Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Skills & Tools</CardTitle>
        </CardHeader>
        <CardContent>
          {skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No skills declared. Use{" "}
              <code className="text-primary text-xs">clawops agent skills set &quot;skill1,skill2&quot;</code>
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Habits Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Habits</CardTitle>
        </CardHeader>
        <CardContent>
          {habits.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No habits registered yet.
            </p>
          ) : (
            <div className="space-y-4">
              {habits.map((habit) => (
                <div
                  key={habit.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{habit.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {habit.type}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {habit.schedule ?? habit.cronExpr ?? habit.trigger ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <StreakDots streaks={habit.streaks} />
                    <span className="text-xs text-muted-foreground">
                      {habit.lastRun ? timeAgo(habit.lastRun) : "never"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sessions Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Radio className="h-4 w-4" />
            Sessions ({sessions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {syncFailed ? (
            <PanelErrorState
              message={syncStatus?.error ?? "Sync failed"}
              actionLabel="Run sync"
              actionHref={`/api/integrations/openclaw/${openclawMapping?.connectionId}/reconcile`}
            />
          ) : sessions.length === 0 ? (
            hasOpenClawLink ? (
              hasSyncRun ? (
                <PanelEmptyState
                  description="No sessions recorded from OpenClaw gateway."
                  diagnostic="Sessions are synced from the OpenClaw gateway during reconciliation. Run a sync to fetch latest sessions."
                  actionLabel="Run sync"
                  actionHref={`/api/integrations/openclaw/${openclawMapping?.connectionId}/reconcile`}
                />
              ) : (
                <PanelEmptyState
                  description="No sessions recorded."
                  diagnostic="Sync has not been run for this connection yet. Run a sync to fetch sessions from OpenClaw gateway."
                  actionLabel="Run sync"
                  actionHref={`/api/integrations/openclaw/${openclawMapping?.connectionId}/reconcile`}
                />
              )
            ) : (
              <p className="text-sm text-muted-foreground">No sessions recorded.</p>
            )
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "h-2.5 w-2.5 rounded-full shrink-0",
                        session.status === "active" ? "bg-emerald-500" : "bg-zinc-500",
                      )}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-mono truncate">
                        {session.sessionKey}
                      </span>
                      <div className="flex items-center gap-2">
                        {session.model && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {session.model}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(session.startedAt, session.endedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {timeAgo(session.startedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cron Jobs Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Timer className="h-4 w-4" />
            Cron Jobs ({cronJobs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cronJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cron jobs configured.</p>
          ) : (
            <div className="space-y-3">
              {cronJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{job.name}</span>
                      <Badge
                        variant={job.status === "active" ? "secondary" : "outline"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {job.status}
                      </Badge>
                    </div>
                    <code className="text-xs text-muted-foreground">
                      {job.cronExpr ?? job.schedule ?? "—"}
                    </code>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {job.nextRun ? `next ${timeAgo(job.nextRun)}` : job.lastRun ? timeAgo(job.lastRun) : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Tasks Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Tasks ({tasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TaskList
            tasks={tasks}
            showAssignee={false}
            showProject
            compact
            limit={10}
            emptyMessage="No tasks assigned."
            emptyDescription="Tasks will appear here when assigned to this agent."
          />
        </CardContent>
      </Card>

      {/* Recent Messages Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <MessageSquare className="h-4 w-4" />
            Recent Messages ({messages.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {syncFailed ? (
            <PanelErrorState
              message={syncStatus?.error ?? "Sync failed"}
              actionLabel="Run sync"
              actionHref={`/api/integrations/openclaw/${openclawMapping?.connectionId}/reconcile`}
            />
          ) : messages.length === 0 ? (
            hasOpenClawLink ? (
              hasSyncRun ? (
                <PanelEmptyState
                  description="No messages from OpenClaw gateway."
                  diagnostic="Messages are synced from the OpenClaw gateway during reconciliation."
                  actionLabel="Run sync"
                  actionHref={`/api/integrations/openclaw/${openclawMapping?.connectionId}/reconcile`}
                />
              ) : (
                <PanelEmptyState
                  description="No messages yet."
                  diagnostic="Sync has not been run for this connection yet."
                  actionLabel="Run sync"
                  actionHref={`/api/integrations/openclaw/${openclawMapping?.connectionId}/reconcile`}
                />
              )
            ) : (
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            )
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const isSent = openclawMapping
                  ? msg.fromAgentId === openclawMapping.externalAgentId
                  : true;
                return (
                  <div
                    key={msg.id}
                    className="flex items-start gap-3"
                  >
                    {isSent ? (
                      <ArrowUpRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                    ) : (
                      <ArrowDownLeft className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <span className="text-sm truncate">
                        {msg.summary ?? msg.content ?? "—"}
                      </span>
                      <div className="flex items-center gap-2">
                        {msg.channel && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {msg.channel}
                          </Badge>
                        )}
                        {msg.messageType && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {msg.messageType}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {timeAgo(msg.sentAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Activity className="h-4 w-4" />
            Recent Activity ({activity.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            hasSyncRun ? (
              <PanelEmptyState
                description="No recent activity recorded."
                diagnostic="Activity is recorded during sync operations and agent interactions."
              />
            ) : (
              <PanelEmptyState
                description="No recent activity recorded."
                diagnostic="Activity will be recorded when sync runs or the agent performs actions."
              />
            )
          ) : (
            <div className="space-y-3">
              {activity.map((event) => {
                const SeverityIcon = severityIcons[event.severity] ?? Info;
                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-3"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                      <SeverityIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span className="text-sm truncate">{event.title}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {event.type}
                        </Badge>
                        <Badge
                          variant={event.severity === "error" || event.severity === "critical" ? "destructive" : "secondary"}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {event.severity}
                        </Badge>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {timeAgo(event.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="py-4">
          <CardContent className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Completion Rate</span>
              <span className="text-xl font-semibold">{completionRate}%</span>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Total Tasks</span>
              <span className="text-xl font-semibold">{tasks.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Artifacts */}
      {artifacts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Artifacts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {artifacts.slice(0, 5).map((artifact) => (
                <div
                  key={artifact.id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{artifact.label}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                      {artifact.value}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {timeAgo(artifact.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
