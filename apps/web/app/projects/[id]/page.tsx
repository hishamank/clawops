import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { ProjectDetail, Task } from "@/lib/types";
import type { ProjectStatus } from "@clawops/domain";
import { timeAgo } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

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

async function getProject(id: string): Promise<ProjectDetail | null> {
  try {
    return await api<ProjectDetail>(`/projects/${id}`, {
      tags: ["projects", `project-${id}`],
      revalidate: 15,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return null;
    throw err;
  }
}

async function getProjectTasks(id: string): Promise<Task[]> {
  try {
    return await api<Task[]>(`/tasks?projectId=${encodeURIComponent(id)}`, {
      tags: ["tasks"],
      revalidate: 30,
    });
  } catch {
    return [];
  }
}

export default async function ProjectDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  const tasks = project.tasks ?? (await getProjectTasks(id));
  const completedTasks = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Back link */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {project.name}
          </h1>
          <Badge
            variant="outline"
            className={cn(projectStatusStyles[project.status])}
          >
            {projectStatusLabels[project.status]}
          </Badge>
        </div>
        {project.description && (
          <p className="text-muted-foreground">{project.description}</p>
        )}
      </div>

      {/* PRD section */}
      {project.prd && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Product Requirements
              {project.prdUpdatedAt && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  Updated {timeAgo(project.prdUpdatedAt)}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground font-sans">
              {project.prd}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Task progress */}
      <Card>
        <CardContent className="py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {completedTasks} of {tasks.length} tasks complete
              </span>
              <span className="font-medium">
                {tasks.length > 0
                  ? Math.round((completedTasks / tasks.length) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{
                  width:
                    tasks.length > 0
                      ? `${Math.round((completedTasks / tasks.length) * 100)}%`
                      : "0%",
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Milestones */}
      {project.milestones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {project.milestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className="flex items-center gap-3"
                >
                  {milestone.status === "done" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-zinc-400" />
                  )}
                  <span
                    className={cn(
                      "text-sm",
                      milestone.status === "done" && "text-muted-foreground line-through"
                    )}
                  >
                    {milestone.title}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Tasks ({tasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks yet.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50 transition-colors"
                >
                  <PriorityBadge priority={task.priority} />
                  <span className="text-sm truncate min-w-0 flex-1">
                    {task.title}
                  </span>
                  <StatusBadge status={task.status} />
                  <span className="text-xs text-muted-foreground shrink-0">
                    {timeAgo(task.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
