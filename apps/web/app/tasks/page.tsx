import { CheckSquare, ListTodo, Clock } from "lucide-react";
import { api } from "@/lib/api";
import type { Task, Agent, Project } from "@/lib/types";
import { timeAgo } from "@/lib/time";
import { StatsCard } from "@/components/stats-card";
import { StatusBadge } from "@/components/status-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { Card, CardContent } from "@/components/ui/card";
import { TaskFilterTabs } from "./filter-tabs";

interface PageProps {
  searchParams: { status?: string };
}

async function getTasks(status?: string): Promise<Task[]> {
  try {
    const query = status && status !== "all" ? `?status=${status}` : "";
    return await api<Task[]>(`/tasks${query}`, { tags: ["tasks"] });
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return [];
    throw err;
  }
}

async function getAgents(): Promise<Agent[]> {
  try {
    return await api<Agent[]>("/agents", { tags: ["agents"] });
  } catch {
    return [];
  }
}

async function getProjects(): Promise<Project[]> {
  try {
    return await api<Project[]>("/projects", { tags: ["projects"] });
  } catch {
    return [];
  }
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default async function TasksPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const { status } = searchParams;
  const [tasks, agents, projects] = await Promise.all([
    getTasks(status),
    getAgents(),
    getProjects(),
  ]);

  const agentMap = new Map(agents.map((a) => [a.id, a.name]));
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  const inProgress = tasks.filter((t) => t.status === "in-progress").length;
  const completedToday = tasks.filter((t) => isToday(t.completedAt)).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Tasks</h1>
        <p className="mt-1 text-muted-foreground">
          Work items across your agent fleet
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title="Total Tasks"
          value={tasks.length}
          icon={ListTodo}
          description="All work items"
        />
        <StatsCard
          title="In Progress"
          value={inProgress}
          icon={Clock}
          description="Currently active"
        />
        <StatsCard
          title="Completed Today"
          value={completedToday}
          icon={CheckSquare}
          description="Done today"
        />
      </div>

      {/* Filter tabs */}
      <TaskFilterTabs current={status ?? "all"} />

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <ListTodo className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No tasks yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Tasks will appear here as your agents create them.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <Card key={task.id} className="transition-colors hover:bg-accent/50">
              <CardContent className="flex items-center gap-4 py-3">
                <PriorityBadge priority={task.priority} />
                <span className="text-sm font-medium truncate min-w-0 flex-1">
                  {task.title}
                </span>
                <StatusBadge status={task.status} />
                <span className="text-xs text-muted-foreground shrink-0 w-24 text-right">
                  {task.assigneeId ? agentMap.get(task.assigneeId) ?? "Unknown" : "Unassigned"}
                </span>
                <span className="text-xs text-muted-foreground shrink-0 w-20 text-right">
                  {task.projectId ? projectMap.get(task.projectId) ?? "—" : "—"}
                </span>
                <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">
                  {timeAgo(task.createdAt)}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
