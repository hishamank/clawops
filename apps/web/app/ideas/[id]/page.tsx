import { notFound } from "next/navigation";
import { ArrowLeft, Tags } from "lucide-react";
import Link from "next/link";
import type { Idea } from "@/lib/types";
import type { IdeaStatus, Source } from "@clawops/domain";
import { timeAgo } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { IDEA_SECTION_KEYS, getIdeaSections, listIdeaTasks } from "@clawops/ideas";
import type { IdeaSectionKey } from "@clawops/ideas";
import { getDb } from "@/lib/server/runtime";
import { ideas, eq } from "@clawops/core";
import { PromoteButton } from "../promote-button";
import { SectionEditor } from "./section-editor";
import { DraftPrdPanel } from "./draft-prd-panel";
import { ReadinessTracker } from "./readiness-tracker";
import { TaskList } from "@/components/tasks/task-list";
import { CreateTaskDialog } from "./create-task-dialog";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const ideaStatusStyles: Record<IdeaStatus, string> = {
  raw: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  reviewed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  promoted: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  archived: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

const ideaStatusLabels: Record<IdeaStatus, string> = {
  raw: "Raw",
  reviewed: "Reviewed",
  promoted: "Promoted",
  archived: "Archived",
};

const sourceStyles: Record<Source, string> = {
  human: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  agent: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  cli: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  script: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

const SECTION_LABELS: Record<IdeaSectionKey, string> = {
  brainstorming: "Brainstorming",
  research: "Research",
  similarIdeas: "Similar Ideas",
  draftPrd: "Draft PRD",
  notes: "Notes",
};

const EDITABLE_SECTIONS = IDEA_SECTION_KEYS.filter((k) => k !== "draftPrd").map((key) => ({
  key,
  label: SECTION_LABELS[key],
}));

async function getIdeaData(id: string) {
  const db = getDb();

  const [ideaRow] = db
    .select()
    .from(ideas)
    .where(eq(ideas.id, id))
    .all();

  if (!ideaRow) {
    return null;
  }

  const sections = getIdeaSections(db, id);
  const rawTasks = listIdeaTasks(db, id);

  // Convert Date fields to strings to match the web app's types
  const idea: Idea = {
    ...ideaRow,
    createdAt: ideaRow.createdAt.toISOString(),
  };

  const tasks = rawTasks.map((task) => ({
    ...task,
    createdAt: task.createdAt.toISOString(),
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    specUpdatedAt: task.specUpdatedAt ? task.specUpdatedAt.toISOString() : null,
  }));

  return { idea, sections, tasks };
}

function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  try {
    const parsed: unknown = JSON.parse(tags);
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
    return [];
  } catch {
    return tags.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

export default async function IdeaDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const result = await getIdeaData(id);

  if (!result) {
    notFound();
  }

  const { idea, sections, tasks } = result;
  const tags = parseTags(idea.tags);
  const isPromoted = idea.status === "promoted";

  const hasDraftPrd = !!sections.draftPrd;
  const hasAtLeastOneTask = tasks.length >= 1;
  const promoteReady = hasDraftPrd && hasAtLeastOneTask;
  const readinessWarnings: string[] = [];
  if (!hasDraftPrd) readinessWarnings.push("add a Draft PRD");
  if (!hasAtLeastOneTask) readinessWarnings.push("link at least one task");
  const promoteDisabledReason = readinessWarnings.length
    ? `Please ${readinessWarnings.join(" and ")} before promoting`
    : undefined;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="space-y-4">
        <Link
          href="/ideas"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Ideas
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">
                {idea.title}
              </h1>
              <Badge
                variant="outline"
                className={cn(ideaStatusStyles[idea.status])}
              >
                {ideaStatusLabels[idea.status]}
              </Badge>
              <Badge
                variant="outline"
                className={cn(sourceStyles[idea.source])}
              >
                {idea.source}
              </Badge>
            </div>
            {idea.description && (
              <p className="text-muted-foreground max-w-3xl">
                {idea.description}
              </p>
            )}
            {tags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Tags className="h-4 w-4 text-muted-foreground" />
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isPromoted && (
              <PromoteButton
                ideaId={id}
                disabled={!promoteReady}
                disabledReason={promoteDisabledReason}
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Created {timeAgo(idea.createdAt)}</span>
          {idea.projectId && (
            <Link
              href={`/projects/${idea.projectId}`}
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              → Promoted to project
            </Link>
          )}
        </div>
      </div>

      {/* Readiness tracker */}
      <ReadinessTracker
        sections={sections}
        taskCount={tasks.length}
        hasDescription={!!idea.description}
      />

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Sections */}
        <div className="lg:col-span-2 space-y-4">
          {EDITABLE_SECTIONS.map(({ key, label }) => (
            <SectionEditor
              key={key}
              ideaId={id}
              sectionKey={key}
              label={label}
              initialContent={sections[key] ?? null}
              readOnly={isPromoted}
            />
          ))}
          <DraftPrdPanel
            ideaId={id}
            initialContent={sections.draftPrd ?? null}
            readOnly={isPromoted}
          />
        </div>

        {/* Right column - Tasks */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Linked Tasks ({tasks.length})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground mb-3">
                    No tasks linked yet
                  </p>
                  <CreateTaskDialog ideaId={id} variant="ghost" size="sm" />
                </div>
              ) : (
                <TaskList
                  tasks={tasks}
                  showAssignee={false}
                  showProject={false}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
