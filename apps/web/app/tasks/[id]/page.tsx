export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Clock, Link2, Ban, ArrowRight, Layers, Calendar, User, FolderKanban } from "lucide-react";
import Link from "next/link";
import type { Task } from "@/lib/types";
import { timeAgo } from "@/lib/time";
import { StatusBadge } from "@/components/status-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/markdown";
import { getTask, listTaskRelations, listTaskResourceLinks, parseTaskProperties } from "@clawops/tasks";
import { listAgents } from "@clawops/agents";
import { listProjects } from "@clawops/projects";
import { getDb } from "@/lib/server/runtime";
import { mapTask, mapAgent, mapProject, mapResourceLink, mapArtifact } from "@/lib/mappers";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TaskDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const db = getDb();
  const dbTask = getTask(db, id);

  if (!dbTask) {
    notFound();
  }

  const task: Task = {
    ...mapTask(dbTask),
    artifacts: dbTask.artifacts.map(mapArtifact),
  };

  const [agents, projects, relations, links] = await Promise.all([
    listAgents(db).map(mapAgent),
    listProjects(db).map(mapProject),
    listTaskRelations(db, id),
    listTaskResourceLinks(db, id).map(mapResourceLink),
  ]);
  const agentMap   = new Map(agents.map((a) => [a.id, a.name]));
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const properties = parseTaskProperties(task);

  // Categorize relations
  const blockers = relations.filter(
    (r) =>
      (r.relation.type === "blocks"     && r.direction === "incoming") ||
      (r.relation.type === "depends-on" && r.direction === "outgoing"),
  );
  const blocking = relations.filter(
    (r) =>
      (r.relation.type === "blocks"     && r.direction === "outgoing") ||
      (r.relation.type === "depends-on" && r.direction === "incoming"),
  );
  const related = relations.filter((r) => r.relation.type === "related-to");

  const assigneeName = task.assigneeId ? (agentMap.get(task.assigneeId) ?? "Unknown") : null;
  const projectName  = task.projectId  ? (projectMap.get(task.projectId)  ?? "Unknown") : null;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Back + title */}
      <div className="flex items-start gap-3">
        <Link
          href="/tasks"
          className="mt-1 shrink-0 rounded-md p-1 text-[#6b7080] transition-colors hover:bg-white/5 hover:text-[#ededef]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {blockers.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-300">
                <Ban className="h-3 w-3" />
                Blocked
              </span>
            )}
            <span className="font-mono text-[11px] text-[#6b7080]">{id}</span>
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#ededef]">{task.title}</h1>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6">
        {/* ── Left: content ── */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Description */}
          {task.description && (
            <Card className="py-0 gap-0">
              <CardContent className="p-5">
                <p className="text-sm leading-relaxed text-[#ededef]/80 whitespace-pre-wrap">
                  {task.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Spec */}
          <Card className="py-0 gap-0">
            <CardHeader className="flex flex-row items-center justify-between py-3 px-5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#6b7080]" />
                <CardTitle className="text-sm font-semibold">Spec</CardTitle>
              </div>
              {task.specUpdatedAt && (
                <div className="flex items-center gap-1 text-[11px] text-[#6b7080]">
                  <Clock className="h-3 w-3" />
                  Updated {timeAgo(task.specUpdatedAt)}
                </div>
              )}
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              {task.specContent ? (
                <Markdown content={task.specContent} />
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="mb-2 h-8 w-8 text-[#6b7080]/40" />
                  <p className="text-sm text-[#6b7080]">No spec yet</p>
                  <p className="mt-1 text-xs text-[#6b7080]/60">
                    Use{" "}
                    <code className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[0.8em] text-[#ededef]">
                      clawops task spec {id} --set &quot;...&quot;
                    </code>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Completion summary */}
          {task.summary && (
            <Card className="py-0 gap-0">
              <CardHeader className="py-3 px-5">
                <CardTitle className="text-sm font-semibold">Completion Summary</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0">
                <Markdown content={task.summary} />
              </CardContent>
            </Card>
          )}

          {/* Blocked by */}
          {blockers.length > 0 && (
            <Card className="py-0 gap-0">
              <CardHeader className="flex flex-row items-center gap-2 py-3 px-5">
                <Ban className="h-4 w-4 text-rose-400" />
                <CardTitle className="text-sm font-semibold text-rose-300">Blocked By</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-1">
                {blockers.map((r) => (
                  <Link
                    key={r.relation.id}
                    href={`/tasks/${r.task.id}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/5"
                  >
                    <StatusBadge status={r.task.status} />
                    <span className="min-w-0 flex-1 truncate text-sm text-[#ededef]/80">
                      {r.task.title}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Blocking others */}
          {blocking.length > 0 && (
            <Card className="py-0 gap-0">
              <CardHeader className="flex flex-row items-center gap-2 py-3 px-5">
                <ArrowRight className="h-4 w-4 text-amber-400" />
                <CardTitle className="text-sm font-semibold">Blocking</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-1">
                {blocking.map((r) => (
                  <Link
                    key={r.relation.id}
                    href={`/tasks/${r.task.id}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/5"
                  >
                    <StatusBadge status={r.task.status} />
                    <span className="min-w-0 flex-1 truncate text-sm text-[#ededef]/80">
                      {r.task.title}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Related tasks */}
          {related.length > 0 && (
            <Card className="py-0 gap-0">
              <CardHeader className="py-3 px-5">
                <CardTitle className="text-sm font-semibold">Related Tasks</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-1">
                {related.map((r) => (
                  <Link
                    key={r.relation.id}
                    href={`/tasks/${r.task.id}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/5"
                  >
                    <StatusBadge status={r.task.status} />
                    <span className="min-w-0 flex-1 truncate text-sm text-[#ededef]/80">
                      {r.task.title}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Links */}
          {links.length > 0 && (
            <Card className="py-0 gap-0">
              <CardHeader className="flex flex-row items-center gap-2 py-3 px-5">
                <Link2 className="h-4 w-4 text-[#6b7080]" />
                <CardTitle className="text-sm font-semibold">Links</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-1">
                {links.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/5"
                  >
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {link.provider}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-sm text-[#ededef]/80">
                      {link.label ?? link.url}
                    </span>
                    <span className="shrink-0 text-xs text-[#6b7080]">{link.resourceType}</span>
                  </a>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right: properties panel ── */}
        <div className="w-64 shrink-0 space-y-4">
          <Card className="py-0 gap-0">
            <CardContent className="p-0">
              {/* Status */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
                <span className="text-xs text-[#6b7080]">Status</span>
                <StatusBadge status={task.status} />
              </div>

              {/* Priority */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
                <span className="text-xs text-[#6b7080]">Priority</span>
                <PriorityBadge priority={task.priority} />
              </div>

              {/* Assignee */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
                <span className="flex items-center gap-1.5 text-xs text-[#6b7080]">
                  <User className="h-3 w-3" />
                  Assignee
                </span>
                <span className="text-xs text-[#ededef]">
                  {assigneeName ?? <span className="text-[#6b7080]">—</span>}
                </span>
              </div>

              {/* Project */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
                <span className="flex items-center gap-1.5 text-xs text-[#6b7080]">
                  <FolderKanban className="h-3 w-3" />
                  Project
                </span>
                {projectName ? (
                  <Link
                    href={`/projects/${task.projectId}`}
                    className="text-xs text-[#5e6ad2] hover:underline"
                  >
                    {projectName}
                  </Link>
                ) : (
                  <span className="text-xs text-[#6b7080]">—</span>
                )}
              </div>

              {/* Due date */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
                <span className="flex items-center gap-1.5 text-xs text-[#6b7080]">
                  <Calendar className="h-3 w-3" />
                  Due Date
                </span>
                <span className="text-xs text-[#ededef]">
                  {task.dueDate
                    ? new Date(task.dueDate).toLocaleDateString()
                    : <span className="text-[#6b7080]">—</span>
                  }
                </span>
              </div>

              {/* Stage */}
              {task.stageId && (
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
                  <span className="flex items-center gap-1.5 text-xs text-[#6b7080]">
                    <Layers className="h-3 w-3" />
                    Stage
                  </span>
                  <span className="text-xs text-[#ededef]">{task.stageId}</span>
                </div>
              )}

              {/* Created */}
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-[#6b7080]">Created</span>
                <span className="text-xs text-[#6b7080]">{timeAgo(task.createdAt)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Custom properties */}
          {Object.keys(properties).length > 0 && (
            <Card className="py-0 gap-0">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-widest text-[#6b7080]/70">
                  Properties
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-3">
                {Object.entries(properties).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between px-4 py-2">
                    <span className="text-xs text-[#6b7080]">{key}</span>
                    <span className="text-xs text-[#ededef]">{String(value)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
