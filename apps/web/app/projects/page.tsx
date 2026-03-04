import { FolderKanban, Activity, FileText } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { ProjectListItem } from "@/lib/types";
import type { ProjectStatus } from "@clawops/domain";
import { timeAgo } from "@/lib/time";
import { StatsCard } from "@/components/stats-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = 'force-dynamic';

const projectStatusStyles: Record<ProjectStatus, string> = {
  planning: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  active: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  paused: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  done: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const projectStatusLabels: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  paused: "Paused",
  done: "Done",
};

async function getProjects(): Promise<ProjectListItem[]> {
  try {
    return await api<ProjectListItem[]>("/projects", { tags: ["projects"] });
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return [];
    throw err;
  }
}

export default async function ProjectsPage(): Promise<React.JSX.Element> {
  const projects = await getProjects();

  const active = projects.filter((p) => p.status === "active").length;
  const planning = projects.filter((p) => p.status === "planning").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-1 text-muted-foreground">
          Strategic containers for focused work
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title="Total Projects"
          value={projects.length}
          icon={FolderKanban}
          description="All projects"
        />
        <StatsCard
          title="Active"
          value={active}
          icon={Activity}
          description="In progress"
        />
        <StatsCard
          title="Planning"
          value={planning}
          icon={FileText}
          description="Not yet started"
        />
      </div>

      {/* Project grid */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <FolderKanban className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No projects yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Projects are created when ideas get promoted.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="transition-colors hover:bg-accent/50 h-full">
                <CardContent className="space-y-3 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold truncate">
                      {project.name}
                    </h3>
                    <Badge
                      variant="outline"
                      className={cn(projectStatusStyles[project.status], "shrink-0")}
                    >
                      {projectStatusLabels[project.status]}
                    </Badge>
                  </div>
                  {project.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{timeAgo(project.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
