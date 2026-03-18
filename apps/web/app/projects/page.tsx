import { FolderKanban, Activity, FileText } from "lucide-react";
import Link from "next/link";
import type { ProjectListItem } from "@/lib/types";
import type { ProjectStatus } from "@clawops/domain";
import { timeAgo } from "@/lib/time";
import { StatsCard } from "@/components/stats-card";
import { cn } from "@/lib/utils";
import { listProjects } from "@clawops/projects";
import { listTasks } from "@clawops/tasks";
import { getDb } from "@/lib/server/runtime";
import { mapProject, mapTask } from "@/lib/mappers";
import { CreateProjectDialog } from "./create-project-dialog";

export const dynamic = "force-dynamic";

const statusStyles: Record<ProjectStatus, string> = {
  planning: "bg-[#6b7080]/10 text-[#6b7080] border-[#6b7080]/20",
  active:   "bg-[#5e6ad2]/10 text-[#5e6ad2] border-[#5e6ad2]/20",
  paused:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
  done:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const statusLabels: Record<ProjectStatus, string> = {
  planning: "Planning",
  active:   "Active",
  paused:   "Paused",
  done:     "Done",
};

interface ProjectWithCounts extends ProjectListItem {
  totalTasks: number;
  doneTasks: number;
}

async function getProjectsWithCounts(): Promise<ProjectWithCounts[]> {
  const db = getDb();
  const projects = listProjects(db).map(mapProject);

  // One query for all tasks; group in memory
  const allTasks = listTasks(db).map(mapTask);
  const byProject = new Map<string, { total: number; done: number }>();
  for (const task of allTasks) {
    if (!task.projectId) continue;
    const entry = byProject.get(task.projectId) ?? { total: 0, done: 0 };
    entry.total++;
    if (task.status === "done") entry.done++;
    byProject.set(task.projectId, entry);
  }

  return projects.map((p) => ({
    ...p,
    totalTasks: byProject.get(p.id)?.total ?? 0,
    doneTasks:  byProject.get(p.id)?.done  ?? 0,
  }));
}

export default async function ProjectsPage(): Promise<React.JSX.Element> {
  const projects = await getProjectsWithCounts();

  const active   = projects.filter((p) => p.status === "active").length;
  const planning = projects.filter((p) => p.status === "planning").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#ededef]">Projects</h1>
          <p className="mt-0.5 text-sm text-[#6b7080]">Strategic containers for focused work</p>
        </div>
        <CreateProjectDialog />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard title="Total" value={projects.length} icon={FolderKanban} description="All projects" />
        <StatsCard title="Active"   value={active}   icon={Activity} description="In progress" />
        <StatsCard title="Planning" value={planning} icon={FileText}  description="Not yet started" />
      </div>

      {/* Project grid */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/8 py-16 text-center">
          <FolderKanban className="mb-3 h-9 w-9 text-[#6b7080]" />
          <p className="text-sm text-[#6b7080]">No projects yet</p>
          <p className="mt-1 text-xs text-[#6b7080]/60">Projects are created when ideas get promoted.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {projects.map((project) => {
            const pct = project.totalTasks > 0
              ? Math.round((project.doneTasks / project.totalTasks) * 100)
              : null;

            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <div className="group h-full rounded-xl border border-white/8 bg-[#0d0d1a] p-5 transition-colors hover:bg-white/[0.03] shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-[#ededef] group-hover:text-white transition-colors truncate">
                      {project.name}
                    </h3>
                    <span className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      statusStyles[project.status],
                    )}>
                      {statusLabels[project.status]}
                    </span>
                  </div>

                  {project.description && (
                    <p className="mt-2 line-clamp-2 text-xs text-[#6b7080]">{project.description}</p>
                  )}

                  {/* Task progress */}
                  {project.totalTasks > 0 && (
                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[10px] text-[#6b7080]">
                          {project.doneTasks}/{project.totalTasks} tasks
                        </span>
                        <span className="font-mono text-[10px] text-[#6b7080]">{pct}%</span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            pct === 100
                              ? "bg-emerald-500"
                              : pct != null && pct >= 50
                              ? "bg-[#5e6ad2]"
                              : "bg-[#5e6ad2]/50",
                          )}
                          style={{ width: `${pct ?? 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {project.totalTasks === 0 && (
                    <div className="mt-4">
                      <div className="h-1 w-full rounded-full bg-white/5" />
                      <p className="mt-1.5 text-[10px] text-[#6b7080]/50">No tasks yet</p>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between text-[10px] text-[#6b7080]/60">
                    <span>{timeAgo(project.createdAt)}</span>
                    {project.repoUrl && (
                      <span className="truncate font-mono">{project.repoUrl.replace(/^https?:\/\//, "")}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
