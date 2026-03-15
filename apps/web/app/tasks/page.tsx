import { CheckSquare, ListTodo, Clock } from "lucide-react";
import type { Task, Agent, ProjectListItem } from "@/lib/types";
import { StatsCard } from "@/components/stats-card";
import { TaskList } from "@/components/tasks/task-list";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskFilterBar } from "@/components/tasks/task-filter-bar";
import { listTasks, getBlockedTaskIds, type ListTasksFilters } from "@clawops/tasks";
import { listAgents } from "@clawops/agents";
import { listProjects } from "@clawops/projects";
import { getDb } from "@/lib/server/runtime";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function withinLast24h(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return new Date(dateStr) > oneDayAgo;
}

export default async function TasksPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const sp = await searchParams;
  const status = str(sp.status);
  const priority = str(sp.priority);
  const assigneeId = str(sp.assigneeId);
  const view = str(sp.view) ?? "list";

  const db = getDb();
  const filters: ListTasksFilters = {};
  if (status && status !== "all") filters.status = status as Task["status"];
  if (priority && priority !== "all") filters.priority = priority as Task["priority"];
  if (assigneeId && assigneeId !== "all") filters.assigneeId = assigneeId;

  const [tasks, agents, projects] = await Promise.all([
    listTasks(db, Object.keys(filters).length > 0 ? filters : undefined) as unknown as Task[],
    listAgents(db) as unknown as Agent[],
    listProjects(db) as unknown as ProjectListItem[],
  ]);

  const agentMap = new Map(agents.map((a) => [a.id, a.name]));
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  // Compute blocked status for all tasks in bulk
  const blockedTaskIds = getBlockedTaskIds(db, tasks.map((t) => t.id));

  const inProgress = tasks.filter((t) => t.status === "in-progress").length;
  const completedToday = tasks.filter((t) => t.status === "done" && withinLast24h(t.completedAt)).length;

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

      {/* Filter bar */}
      <TaskFilterBar
        basePath="/tasks"
        current={{ status, priority, assigneeId, view }}
        agents={agents.map((a) => ({ id: a.id, name: a.name }))}
        showViewToggle
      />

      {/* Task view */}
      {view === "board" ? (
        <TaskBoard
          tasks={tasks}
          agentMap={agentMap}
          projectMap={projectMap}
          blockedTaskIds={blockedTaskIds}
        />
      ) : (
        <TaskList
          tasks={tasks}
          agentMap={agentMap}
          projectMap={projectMap}
          blockedTaskIds={blockedTaskIds}
        />
      )}
    </div>
  );
}
