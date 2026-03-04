import { notFound } from "next/navigation";
import { ArrowLeft, Clock, CheckCircle2, Zap } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Agent, Task, Habit, HabitStreak, Artifact } from "@/lib/types";
import { timeAgo } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface AgentDetailResponse extends Agent {
  recentTasks?: Task[];
  habits?: (Habit & { streaks?: HabitStreak[] })[];
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

const taskStatusIcons: Record<Task["status"], string> = {
  backlog: "text-zinc-400",
  todo: "text-blue-400",
  "in-progress": "text-amber-400",
  review: "text-purple-400",
  done: "text-emerald-400",
  cancelled: "text-zinc-500",
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

async function getAgent(id: string): Promise<AgentDetailResponse | null> {
  try {
    return await api<AgentDetailResponse>(`/agents/${id}`, {
      tags: ["agents", `agent-${id}`],
      revalidate: 15,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return null;
    throw err;
  }
}

async function getAgentTasks(id: string): Promise<Task[]> {
  try {
    return await api<Task[]>(`/tasks?assigneeId=${id}`, {
      tags: ["tasks"],
      revalidate: 30,
    });
  } catch {
    return [];
  }
}

async function getAgentArtifacts(tasks: Task[]): Promise<Artifact[]> {
  const doneTasks = tasks.filter((t) => t.status === "done");
  if (doneTasks.length === 0) return [];

  const results = await Promise.all(
    doneTasks.slice(0, 5).map(async (task) => {
      try {
        const taskDetail = await api<Task & { artifacts?: Artifact[] }>(
          `/tasks/${task.id}`,
          { tags: ["tasks"], revalidate: 60 }
        );
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

      {/* Active Tasks Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Tasks ({tasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks assigned.</p>
          ) : (
            <div className="space-y-3">
              {tasks.slice(0, 10).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CheckCircle2
                      className={cn("h-4 w-4 shrink-0", taskStatusIcons[task.status])}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm truncate">{task.title}</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {task.status}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {timeAgo(task.createdAt)}
                  </span>
                </div>
              ))}
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
