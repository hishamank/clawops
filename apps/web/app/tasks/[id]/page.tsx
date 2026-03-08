export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Clock } from "lucide-react";
import Link from "next/link";
import type { Task, Agent, ProjectListItem } from "@/lib/types";
import { timeAgo } from "@/lib/time";
import { StatusBadge } from "@/components/status-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTask } from "@clawops/tasks";
import { listAgents } from "@clawops/agents";
import { listProjects } from "@clawops/projects";
import { getDb } from "@/lib/server/runtime";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function loadTask(id: string): Promise<Task | null> {
  return getTask(getDb(), id) as unknown as Task | null;
}

async function loadAgents(): Promise<Agent[]> {
  return listAgents(getDb()) as unknown as Agent[];
}

async function loadProjects(): Promise<ProjectListItem[]> {
  return listProjects(getDb()) as unknown as ProjectListItem[];
}

export default async function TaskDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const task = await loadTask(id);
  
  if (!task) {
    notFound();
  }

  const [agents, projects] = await Promise.all([loadAgents(), loadProjects()]);
  const agentMap = new Map(agents.map((a) => [a.id, a.name]));
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/tasks">
          <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold tracking-tight">{task.title}</h1>
          <p className="text-muted-foreground mt-1">Task {id}</p>
        </div>
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        {task.assigneeId && (
          <Badge variant="secondary">
            Assignee: {agentMap.get(task.assigneeId) ?? "Unknown"}
          </Badge>
        )}
        {task.projectId && (
          <Badge variant="secondary">
            Project: {projectMap.get(task.projectId) ?? "Unknown"}
          </Badge>
        )}
        {task.dueDate && (
          <Badge variant="outline">
            Due: {new Date(task.dueDate).toLocaleDateString()}
          </Badge>
        )}
      </div>

      {/* Description */}
      {task.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Description</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground whitespace-pre-wrap">
            {task.description}
          </CardContent>
        </Card>
      )}

      {/* Spec */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <CardTitle className="text-lg">Spec</CardTitle>
            </div>
            {task.specUpdatedAt && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Updated {timeAgo(task.specUpdatedAt)}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {task.specContent ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm">{task.specContent}</pre>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">No spec yet</p>
              <p className="text-xs mt-1">
                Use the CLI to add a spec: <code className="bg-muted px-2 py-1 rounded">clawops task spec {id} --set "..."</code>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary (if completed) */}
      {task.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Completion Summary</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground whitespace-pre-wrap">
            {task.summary}
          </CardContent>
        </Card>
      )}

      {/* Created at */}
      <div className="text-xs text-muted-foreground">
        Created {timeAgo(task.createdAt)}
      </div>
    </div>
  );
}
