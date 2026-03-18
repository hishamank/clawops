import { notFound } from "next/navigation";
import {
  ArrowLeft, Radio, Timer,
  MessageSquare, Activity, ArrowUpRight, ArrowDownLeft,
  Link2, AlertCircle, AlertTriangle, Info, User,
} from "lucide-react";
import Link from "next/link";
import type { Agent, Task, Habit, Artifact, OpenClawSession, AgentMessage, ActivityEvent, OpenClawMapping } from "@/lib/types";
import type { StreakEntry } from "@clawops/habits";
import { timeAgo } from "@/lib/time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskList } from "@/components/tasks/task-list";
import { TaskFilterBar } from "@/components/tasks/task-filter-bar";
import { AgentTabBar } from "@/components/agents/agent-tab-bar";
import { cn } from "@/lib/utils";
import { getAgent as getAgentById, getOpenClawMappingByAgentId } from "@clawops/agents";
import { listTasks, getTask, getBlockedTaskIds } from "@clawops/tasks";
import { listHabits, getHabitStreak, listCronJobs } from "@clawops/habits";
import {
  openclawSessions, agentMessages, activityEvents, syncRuns,
  eq, or, and, desc, type SyncRun,
} from "@clawops/core";
import { getDb } from "@/lib/server/runtime";
import { PanelEmptyState } from "@/components/agents/panel-empty-state";
import { PanelErrorState } from "@/components/agents/panel-error-state";
import { mapAgent, mapTask, mapHabit, mapArtifact } from "@/lib/mappers";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface AgentDetailData extends Agent {
  allTasks: Task[];
  blockedTaskIds: Set<string>;
  habits: (Habit & { streaks?: StreakEntry[] })[];
  sessions: OpenClawSession[];
  cronJobs: Habit[];
  messages: AgentMessage[];
  activity: ActivityEvent[];
  openclawMapping: OpenClawMapping | null;
  syncStatus: SyncRun | null;
  artifacts: Artifact[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusDot: Record<Agent["status"], string> = {
  online:  "bg-emerald-500",
  busy:    "bg-amber-500",
  idle:    "bg-amber-500",
  offline: "bg-[#6b7080]/50",
};

const statusLabel: Record<Agent["status"], string> = {
  online: "Active", busy: "Busy", idle: "Idle", offline: "Offline",
};

function getInitials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
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

function formatDuration(startedAt: string | Date, endedAt: string | Date | null): string {
  if (!endedAt) return "active";
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function StreakDots({ streaks }: { streaks?: StreakEntry[] }): React.JSX.Element {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 7 }, (_, i) => {
        const s = streaks?.[i];
        const color = !s ? "bg-white/8" : s.ran ? (s.success ? "bg-emerald-500" : "bg-rose-500") : "bg-white/8";
        return <div key={i} className={cn("h-2.5 w-2.5 rounded-sm", color)} />;
      })}
    </div>
  );
}

const severityIcon = {
  info: Info, warning: AlertTriangle, error: AlertCircle, critical: AlertCircle,
} as const;

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function getAgentData(id: string): Promise<AgentDetailData | null> {
  const db = getDb();
  const dbAgent = getAgentById(db, id);
  if (!dbAgent) return null;

  const agent = mapAgent(dbAgent);

  const allTasksRaw = listTasks(db, { assigneeId: id });
  const allTasks = allTasksRaw.map(mapTask);
  const blockedTaskIds = getBlockedTaskIds(db, allTasksRaw.map((t) => t.id));

  const habits = listHabits(db, id).map((h) => ({
    ...mapHabit(h),
    streaks: getHabitStreak(db, h.id, 7),
  }));

  const openclawMapping = getOpenClawMappingByAgentId(db, id);

  let sessions: OpenClawSession[] = [];
  if (openclawMapping) {
    sessions = db
      .select()
      .from(openclawSessions)
      .where(and(
        eq(openclawSessions.connectionId, openclawMapping.connectionId),
        eq(openclawSessions.agentId, openclawMapping.externalAgentId),
      ))
      .orderBy(desc(openclawSessions.updatedAt))
      .limit(10)
      .all() as OpenClawSession[];
  }

  const cronJobs = listCronJobs(db).filter((h) => h.agentId === id).map(mapHabit);

  let messages: AgentMessage[] = [];
  if (openclawMapping) {
    messages = db
      .select()
      .from(agentMessages)
      .where(or(
        eq(agentMessages.fromAgentId, openclawMapping.externalAgentId),
        eq(agentMessages.toAgentId, openclawMapping.externalAgentId),
      ))
      .orderBy(desc(agentMessages.sentAt))
      .limit(10)
      .all() as AgentMessage[];
  }

  const activity = db
    .select()
    .from(activityEvents)
    .where(eq(activityEvents.agentId, id))
    .orderBy(desc(activityEvents.createdAt))
    .limit(20)
    .all() as ActivityEvent[];

  let syncStatus: SyncRun | null = null;
  if (openclawMapping) {
    const latest = db
      .select()
      .from(syncRuns)
      .where(eq(syncRuns.connectionId, openclawMapping.connectionId))
      .orderBy(desc(syncRuns.startedAt))
      .limit(1)
      .get() as SyncRun | undefined;
    syncStatus = latest ?? null;
  }

  // Artifacts from recent done tasks
  const doneTasks = allTasks.filter((t) => t.status === "done").slice(0, 5);
  const artifactArrays = await Promise.all(
    doneTasks.map(async (task) => {
      const detail = getTask(db, task.id);
      return detail ? detail.artifacts.map(mapArtifact) : [];
    }),
  );
  const artifacts = artifactArrays.flat();

  return {
    ...agent, allTasks, blockedTaskIds, habits, sessions, cronJobs,
    messages, activity, openclawMapping, syncStatus, artifacts,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AgentProfile({ params, searchParams }: PageProps): Promise<React.JSX.Element> {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const VALID_TABS = new Set(["overview", "tasks", "activity", "automation"]);
  const rawTab = typeof sp.tab === "string" ? sp.tab : "overview";
  const tab = (VALID_TABS.has(rawTab) ? rawTab : "overview") as
    "overview" | "tasks" | "activity" | "automation";

  const agent = await getAgentData(id);
  if (!agent) notFound();

  const { allTasks, blockedTaskIds, habits, sessions, cronJobs, messages, activity, openclawMapping, syncStatus, artifacts } = agent;

  const skills = parseSkills(agent.skills);
  const hasOpenClawLink = openclawMapping !== null;
  const hasSyncRun = syncStatus !== null;
  const syncFailed = syncStatus?.status === "failed";

  const activeTasks = allTasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const completedTasks = allTasks.filter((t) => t.status === "done");
  const completionRate = allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0;

  // Task counts for filter bar
  const taskCounts = {
    all:           allTasks.length,
    blocked:       activeTasks.filter((t) => blockedTaskIds.has(t.id)).length,
    backlog:       allTasks.filter((t) => t.status === "backlog").length,
    todo:          allTasks.filter((t) => t.status === "todo").length,
    "in-progress": allTasks.filter((t) => t.status === "in-progress").length,
    review:        allTasks.filter((t) => t.status === "review").length,
    done:          allTasks.filter((t) => t.status === "done").length,
  };

  // Tab-level badge counts
  const tabCounts = {
    tasks:      activeTasks.length,
    activity:   activity.length,
    automation: habits.length + cronJobs.length,
  };

  // Task filtering for tasks tab
  const taskStatus = typeof sp.status === "string" ? sp.status : undefined;
  const taskPriority = typeof sp.priority === "string" ? sp.priority : undefined;

  let filteredTasks = allTasks;
  if (taskStatus === "blocked") {
    filteredTasks = activeTasks.filter((t) => blockedTaskIds.has(t.id));
  } else if (taskStatus && taskStatus !== "all") {
    filteredTasks = allTasks.filter((t) => t.status === taskStatus as Task["status"]);
  }
  if (taskPriority && taskPriority !== "all") {
    filteredTasks = filteredTasks.filter((t) => t.priority === taskPriority as Task["priority"]);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Back */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-[#6b7080] transition-colors hover:text-[#ededef]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Fleet
      </Link>

      {/* Identity strip */}
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#5e6ad2]/10 text-xl font-bold text-[#5e6ad2]">
          {agent.avatar ?? getInitials(agent.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-[#ededef]">{agent.name}</h1>
            <div className="flex items-center gap-1.5">
              <div className={cn("h-2 w-2 rounded-full", statusDot[agent.status])} />
              <span className="text-xs text-[#6b7080]">{statusLabel[agent.status]}</span>
            </div>
          </div>
          <p className="mt-0.5 text-sm text-[#6b7080]">{agent.role}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded bg-white/8 px-2 py-0.5 font-mono text-[11px] text-[#6b7080]">
              {agent.model}
            </span>
            {agent.framework && (
              <span className="rounded border border-white/8 px-2 py-0.5 text-[11px] text-[#6b7080]">
                {agent.framework}
              </span>
            )}
            <span className="text-[11px] text-[#6b7080]/60">
              Active {timeAgo(agent.lastActive)}
            </span>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex shrink-0 gap-3">
          <div className="flex flex-col items-center rounded-xl border border-white/8 bg-[#0d0d1a] px-4 py-3">
            <span className="text-xl font-semibold tabular-nums text-[#ededef]">{completionRate}%</span>
            <span className="mt-0.5 text-[10px] text-[#6b7080]">Completion</span>
          </div>
          <div className="flex flex-col items-center rounded-xl border border-white/8 bg-[#0d0d1a] px-4 py-3">
            <span className="text-xl font-semibold tabular-nums text-[#ededef]">{allTasks.length}</span>
            <span className="mt-0.5 text-[10px] text-[#6b7080]">Total tasks</span>
          </div>
        </div>
      </div>

      {/* OpenClaw bar */}
      {openclawMapping && (
        <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-[#5e6ad2]" />
          <span className="text-xs text-[#6b7080]">
            Linked to{" "}
            <span className="font-medium text-[#ededef]">{openclawMapping.externalAgentName}</span>
            {openclawMapping.workspacePath && (
              <> · <code className="font-mono text-[#6b7080]">{openclawMapping.workspacePath}</code></>
            )}
            {openclawMapping.lastSeenAt && (
              <> · Last seen {timeAgo(openclawMapping.lastSeenAt)}</>
            )}
          </span>
        </div>
      )}

      {/* Tab bar */}
      <AgentTabBar counts={tabCounts} />

      {/* ── Overview Tab ── */}
      {tab === "overview" && (
        <div className="space-y-4">
          {/* Skills */}
          <Card className="py-0 gap-0">
            <CardHeader className="px-5 py-3 border-b border-white/6">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-[#6b7080]/70">
                Skills & Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {skills.length === 0 ? (
                <p className="text-xs text-[#6b7080]">
                  No skills declared. Use{" "}
                  <code className="rounded bg-white/8 px-1 py-0.5 font-mono text-[0.85em] text-[#ededef]">
                    clawops agent skills set &quot;skill1,skill2&quot;
                  </code>
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <span key={skill} className="rounded-full bg-[#5e6ad2]/10 px-3 py-1 text-xs font-medium text-[#5e6ad2]">
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Knowledge */}
          <Card className="py-0 gap-0">
            <CardHeader className="px-5 py-3 border-b border-white/6">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-[#6b7080]/70">
                Knowledge
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {agent.memoryPath ? (
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 shrink-0 text-[#6b7080]" />
                  <code className="text-xs text-[#6b7080]">{agent.memoryPath}</code>
                </div>
              ) : (
                <p className="text-xs text-[#6b7080]">
                  No memory path configured. Set via{" "}
                  <code className="rounded bg-white/8 px-1 py-0.5 font-mono text-[0.85em] text-[#ededef]">
                    clawops agent init --memory-path &lt;path&gt;
                  </code>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent artifacts */}
          {artifacts.length > 0 && (
            <Card className="py-0 gap-0">
              <CardHeader className="px-5 py-3 border-b border-white/6">
                <CardTitle className="text-xs font-semibold uppercase tracking-widest text-[#6b7080]/70">
                  Recent Artifacts
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                {artifacts.slice(0, 5).map((artifact) => (
                  <div key={artifact.id} className="flex items-center justify-between px-5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[#ededef]">{artifact.label}</p>
                      <p className="mt-0.5 truncate text-[11px] text-[#6b7080]">{artifact.value}</p>
                    </div>
                    <span className="ml-3 shrink-0 text-[11px] text-[#6b7080]">
                      {timeAgo(artifact.createdAt)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Tasks Tab ── */}
      {tab === "tasks" && (
        <div className="space-y-4">
          <TaskFilterBar
            basePath={`/agents/${id}`}
            current={{ status: taskStatus, priority: taskPriority, view: "list" }}
            preserveParams={{ tab: "tasks" }}
            counts={taskCounts}
            showAssignee={false}
            showPriority
          />
          <TaskList
            tasks={filteredTasks}
            blockedTaskIds={blockedTaskIds}
            showAssignee={false}
            showProject
            emptyMessage="No tasks assigned."
            emptyDescription="Tasks will appear here when assigned to this agent."
          />
        </div>
      )}

      {/* ── Activity Tab ── */}
      {tab === "activity" && (
        <div className="space-y-4">
          {/* Sessions */}
          <Card className="py-0 gap-0">
            <CardHeader className="flex flex-row items-center gap-2 px-5 py-3 border-b border-white/6">
              <Radio className="h-3.5 w-3.5 text-[#6b7080]" />
              <CardTitle className="text-sm font-semibold">Sessions ({sessions.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              {syncFailed ? (
                <div className="p-5"><PanelErrorState message={syncStatus?.error ?? "Sync failed"} /></div>
              ) : sessions.length === 0 ? (
                <div className="p-5">
                  {hasOpenClawLink ? (
                    <PanelEmptyState
                      description="No sessions recorded from OpenClaw gateway."
                      diagnostic={hasSyncRun ? "Sessions are synced during reconciliation." : "Sync has not been run yet."}
                    />
                  ) : (
                    <p className="text-xs text-[#6b7080]">No sessions recorded.</p>
                  )}
                </div>
              ) : (
                sessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between px-5 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={cn("h-1.5 w-1.5 shrink-0 rounded-full", session.status === "active" ? "bg-emerald-500" : "bg-[#6b7080]/50")} />
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs text-[#ededef]">{session.sessionKey}</p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {session.model && (
                            <span className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[10px] text-[#6b7080]">
                              {session.model}
                            </span>
                          )}
                          <span className="text-[10px] text-[#6b7080]">{formatDuration(session.startedAt, session.endedAt)}</span>
                        </div>
                      </div>
                    </div>
                    <span className="ml-3 shrink-0 text-[11px] text-[#6b7080]">{timeAgo(session.startedAt)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Messages */}
          <Card className="py-0 gap-0">
            <CardHeader className="flex flex-row items-center gap-2 px-5 py-3 border-b border-white/6">
              <MessageSquare className="h-3.5 w-3.5 text-[#6b7080]" />
              <CardTitle className="text-sm font-semibold">Messages ({messages.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              {syncFailed ? (
                <div className="p-5"><PanelErrorState message={syncStatus?.error ?? "Sync failed"} /></div>
              ) : messages.length === 0 ? (
                <div className="p-5">
                  {hasOpenClawLink ? (
                    <PanelEmptyState
                      description="No messages synced."
                      diagnostic={hasSyncRun ? "Messages sync from OpenClaw gateway." : "Sync has not been run yet."}
                    />
                  ) : (
                    <p className="text-xs text-[#6b7080]">No messages yet.</p>
                  )}
                </div>
              ) : (
                messages.map((msg) => {
                  const isSent = openclawMapping
                    ? msg.fromAgentId === openclawMapping.externalAgentId
                    : true;
                  return (
                    <div key={msg.id} className="flex items-start gap-3 px-5 py-2.5">
                      {isSent
                        ? <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                        : <ArrowDownLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      }
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-[#ededef]">{msg.summary ?? msg.content ?? "—"}</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          {msg.channel && (
                            <span className="rounded border border-white/8 px-1.5 py-0.5 text-[10px] text-[#6b7080]">{msg.channel}</span>
                          )}
                          {msg.messageType && (
                            <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-[#6b7080]">{msg.messageType}</span>
                          )}
                        </div>
                      </div>
                      <span className="ml-2 shrink-0 text-[11px] text-[#6b7080]">{timeAgo(msg.sentAt)}</span>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Activity events */}
          <Card className="py-0 gap-0">
            <CardHeader className="flex flex-row items-center gap-2 px-5 py-3 border-b border-white/6">
              <Activity className="h-3.5 w-3.5 text-[#6b7080]" />
              <CardTitle className="text-sm font-semibold">Events ({activity.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              {syncFailed ? (
                <div className="p-5"><PanelErrorState message={syncStatus?.error ?? "Sync failed"} /></div>
              ) : activity.length === 0 ? (
                <div className="p-5">
                  <PanelEmptyState
                    description="No recent activity recorded."
                    diagnostic="Activity is recorded during sync and agent interactions."
                  />
                </div>
              ) : (
                activity.map((event) => {
                  const SIcon = severityIcon[event.severity] ?? Info;
                  return (
                    <div key={event.id} className="flex items-center gap-3 px-5 py-2.5">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/5">
                        <SIcon className="h-3 w-3 text-[#6b7080]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-[#ededef]">{event.title}</p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="text-[10px] text-[#6b7080]">{event.type}</span>
                          <span className="text-[#6b7080]/40">·</span>
                          <span className={cn(
                            "text-[10px]",
                            event.severity === "error" || event.severity === "critical"
                              ? "text-rose-400"
                              : event.severity === "warning"
                              ? "text-amber-400"
                              : "text-[#6b7080]",
                          )}>
                            {event.severity}
                          </span>
                        </div>
                      </div>
                      <span className="ml-2 shrink-0 text-[11px] text-[#6b7080]">{timeAgo(event.createdAt)}</span>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Automation Tab ── */}
      {tab === "automation" && (
        <div className="space-y-4">
          {/* Habits */}
          <Card className="py-0 gap-0">
            <CardHeader className="px-5 py-3 border-b border-white/6">
              <CardTitle className="text-sm font-semibold">Habits ({habits.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              {habits.length === 0 ? (
                <div className="p-5">
                  <p className="text-xs text-[#6b7080]">No habits registered yet.</p>
                </div>
              ) : (
                habits.map((habit) => (
                  <div key={habit.id} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#ededef]">{habit.name}</span>
                        <span className="rounded border border-white/8 px-1.5 py-0.5 text-[10px] text-[#6b7080]">
                          {habit.type}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#6b7080]">
                        {habit.schedule ?? habit.cronExpr ?? habit.trigger ?? "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <StreakDots streaks={habit.streaks} />
                      <span className="text-[11px] text-[#6b7080]">
                        {habit.lastRun ? timeAgo(habit.lastRun) : "never"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Cron jobs */}
          <Card className="py-0 gap-0">
            <CardHeader className="flex flex-row items-center gap-2 px-5 py-3 border-b border-white/6">
              <Timer className="h-3.5 w-3.5 text-[#6b7080]" />
              <CardTitle className="text-sm font-semibold">Cron Jobs ({cronJobs.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              {cronJobs.length === 0 ? (
                <div className="p-5">
                  {hasOpenClawLink ? (
                    <PanelEmptyState
                      description="No cron jobs synced."
                      diagnostic={hasSyncRun ? "Cron jobs sync from OpenClaw gateway." : "Sync has not been run yet."}
                    />
                  ) : (
                    <p className="text-xs text-[#6b7080]">No cron jobs configured.</p>
                  )}
                </div>
              ) : (
                cronJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#ededef]">{job.name}</span>
                        <span className={cn(
                          "rounded px-1.5 py-0.5 text-[10px]",
                          job.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-white/5 text-[#6b7080]",
                        )}>
                          {job.status}
                        </span>
                      </div>
                      <code className="mt-0.5 text-[11px] text-[#6b7080]">
                        {job.cronExpr ?? job.schedule ?? "—"}
                      </code>
                    </div>
                    <span className="text-[11px] text-[#6b7080]">
                      {job.nextRun
                        ? `next ${timeAgo(job.nextRun)}`
                        : job.lastRun
                        ? timeAgo(job.lastRun)
                        : "—"}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
