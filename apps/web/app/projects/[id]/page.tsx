import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import type { ProjectDetail, Task } from "@/lib/types";
import type { ProjectStatus } from "@clawops/domain";
import { timeAgo } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskList } from "@/components/tasks/task-list";
import { cn } from "@/lib/utils";
import { getProject as getProjectByIdFromPackage } from "@clawops/projects";
import { listTasks } from "@clawops/tasks";
import { getDb } from "@/lib/server/runtime";

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
  const project = getProjectById(id);
  return project as unknown as ProjectDetail | null;
}

async function getProjectTasks(id: string): Promise<Task[]> {
  return listTasks(getDb(), { projectId: id }) as unknown as Task[];
}

function getProjectById(id: string): ReturnType<typeof getProjectByIdFromPackage> {
  return getProjectByIdFromPackage(getDb(), id);
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

      {/* Spec section */}
      {project.specContent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Project Spec
              {project.specUpdatedAt && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  Updated {timeAgo(project.specUpdatedAt)}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground font-sans">
              {project.specContent}
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
          <TaskList
            tasks={tasks}
            showAssignee
            showProject={false}
            compact
            emptyMessage="No tasks yet."
            emptyDescription="Tasks will appear here once created for this project."
          />
        </CardContent>
      </Card>
    </div>
  );
}
