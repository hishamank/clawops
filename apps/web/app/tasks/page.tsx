import type { Task } from "@/lib/types";
import { TaskList } from "@/components/tasks/task-list";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskFilterBar } from "@/components/tasks/task-filter-bar";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { listTasks, getBlockedTaskIds } from "@clawops/tasks";
import { listAgents } from "@clawops/agents";
import { listProjects } from "@clawops/projects";
import { getDb } from "@/lib/server/runtime";
import { mapTask, mapAgent, mapProject } from "@/lib/mappers";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export default async function TasksPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const sp = await searchParams;
  const status   = str(sp.status);
  const priority = str(sp.priority);
  const assigneeId = str(sp.assigneeId);
  const view = str(sp.view) ?? "list";

  const db = getDb();
  const VALID_STATUSES: Task["status"][] = ["backlog", "todo", "in-progress", "review", "done", "cancelled"];
  const VALID_PRIORITIES: Task["priority"][] = ["low", "medium", "high", "urgent"];

  // Fetch everything once; filter in memory (SQLite is local — no perf concern)
  const [allTasksRaw, agents, projects] = [
    listTasks(db),
    listAgents(db).map(mapAgent),
    listProjects(db).map(mapProject),
  ];

  const allTasks = allTasksRaw.map(mapTask);
  const agentMap   = new Map(agents.map((a) => [a.id, a.name]));
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  // Compute blocked status for ALL tasks in one DB call
  const blockedTaskIds = getBlockedTaskIds(db, allTasksRaw.map((t) => t.id));

  // Per-status counts (for tab badges)
  const nonTerminal = allTasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const counts = {
    all:           allTasks.length,
    blocked:       nonTerminal.filter((t) => blockedTaskIds.has(t.id)).length,
    backlog:       allTasks.filter((t) => t.status === "backlog").length,
    todo:          allTasks.filter((t) => t.status === "todo").length,
    "in-progress": allTasks.filter((t) => t.status === "in-progress").length,
    review:        allTasks.filter((t) => t.status === "review").length,
    done:          allTasks.filter((t) => t.status === "done").length,
  };

  // Apply filters
  let filteredTasks = allTasks;

  if (status === "blocked") {
    filteredTasks = nonTerminal.filter((t) => blockedTaskIds.has(t.id));
  } else if (status && status !== "all" && VALID_STATUSES.includes(status as Task["status"])) {
    filteredTasks = allTasks.filter((t) => t.status === (status as Task["status"]));
  }

  if (priority && priority !== "all" && VALID_PRIORITIES.includes(priority as Task["priority"])) {
    filteredTasks = filteredTasks.filter((t) => t.priority === (priority as Task["priority"]));
  }
  if (assigneeId && assigneeId !== "all") {
    filteredTasks = filteredTasks.filter((t) => t.assigneeId === assigneeId);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#ededef]">Tasks</h1>
          <p className="mt-0.5 text-sm text-[#6b7080]">Work items across your agent fleet</p>
        </div>
        <CreateTaskDialog
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        />
      </div>

      {/* Filter bar with live counts */}
      <TaskFilterBar
        basePath="/tasks"
        current={{ status, priority, assigneeId, view }}
        counts={counts}
        agents={agents.map((a) => ({ id: a.id, name: a.name }))}
        showViewToggle
      />

      {/* Task view */}
      {view === "board" ? (
        <TaskBoard
          tasks={filteredTasks}
          agentMap={agentMap}
          projectMap={projectMap}
          blockedTaskIds={blockedTaskIds}
        />
      ) : (
        <TaskList
          tasks={filteredTasks}
          agentMap={agentMap}
          projectMap={projectMap}
          blockedTaskIds={blockedTaskIds}
          showAssignee
          showProject
        />
      )}
    </div>
  );
}
