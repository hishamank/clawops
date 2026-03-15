export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Clock, Link2, Ban, ArrowRight, Layers } from "lucide-react";
import Link from "next/link";
import type { Task, Agent, ProjectListItem, TaskRelationWithTask, ResourceLink } from "@/lib/types";
import { timeAgo } from "@/lib/time";
import { StatusBadge } from "@/components/status-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTask, listTaskRelations, listTaskResourceLinks, parseTaskProperties } from "@clawops/tasks";
import { listAgents } from "@clawops/agents";
import { listProjects } from "@clawops/projects";
import { getDb } from "@/lib/server/runtime";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TaskDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const db = getDb();
  const task = getTask(db, id) as unknown as Task | null;

  if (!task) {
    notFound();
  }

  const [agents, projects, relations, links] = await Promise.all([
    listAgents(db) as unknown as Agent[],
    listProjects(db) as unknown as ProjectListItem[],
    listTaskRelations(db, id) as unknown as TaskRelationWithTask[],
    listTaskResourceLinks(db, id) as unknown as ResourceLink[],
  ]);
  const agentMap = new Map(agents.map((a) => [a.id, a.name]));
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const properties = parseTaskProperties(task);

  // Categorize relations
  const blockers = relations.filter(
    (r) =>
      (r.relation.type === "blocks" && r.direction === "incoming") ||
      (r.relation.type === "depends-on" && r.direction === "outgoing"),
  );
  const blocking = relations.filter(
    (r) =>
      (r.relation.type === "blocks" && r.direction === "outgoing") ||
      (r.relation.type === "depends-on" && r.direction === "incoming"),
  );
  const related = relations.filter((r) => r.relation.type === "related-to");

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
          <Link href={`/projects/${task.projectId}`}>
            <Badge variant="secondary">
              Project: {projectMap.get(task.projectId) ?? "Unknown"}
            </Badge>
          </Link>
        )}
        {task.dueDate && (
          <Badge variant="outline">
            Due: {new Date(task.dueDate).toLocaleDateString()}
          </Badge>
        )}
        {blockers.length > 0 && (
          <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/20">
            <Ban className="h-3 w-3 mr-1" />
            Blocked
          </Badge>
        )}
        {task.stageId && (
          <Badge variant="outline">
            <Layers className="h-3 w-3 mr-1" />
            Stage
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

      {/* Blockers */}
      {blockers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Ban className="h-5 w-5 text-rose-400" />
              Blocked By
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {blockers.map((r) => (
              <Link
                key={r.relation.id}
                href={`/tasks/${r.task.id}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50 transition-colors"
              >
                <StatusBadge status={r.task.status} />
                <span className="text-sm truncate flex-1">{r.task.title}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Blocking others */}
      {blocking.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-amber-400" />
              Blocking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {blocking.map((r) => (
              <Link
                key={r.relation.id}
                href={`/tasks/${r.task.id}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50 transition-colors"
              >
                <StatusBadge status={r.task.status} />
                <span className="text-sm truncate flex-1">{r.task.title}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Related tasks */}
      {related.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Related Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {related.map((r) => (
              <Link
                key={r.relation.id}
                href={`/tasks/${r.task.id}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50 transition-colors"
              >
                <StatusBadge status={r.task.status} />
                <span className="text-sm truncate flex-1">{r.task.title}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Resource Links */}
      {links.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Links
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50 transition-colors"
              >
                <Badge variant="outline" className="shrink-0">
                  {link.provider}
                </Badge>
                <span className="text-sm truncate flex-1">
                  {link.label ?? link.url}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {link.resourceType}
                </span>
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Properties */}
      {Object.keys(properties).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              {Object.entries(properties).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs text-muted-foreground">{key}</dt>
                  <dd className="text-sm">{String(value)}</dd>
                </div>
              ))}
            </dl>
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
                Use the CLI to add a spec: <code className="bg-muted px-2 py-1 rounded">clawops task spec {id} --set &quot;...&quot;</code>
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
