import { notFound } from "next/navigation";
import { ArrowLeft, Lightbulb, Tags } from "lucide-react";
import Link from "next/link";
import type { Idea } from "@/lib/types";
import type { IdeaStatus, Source } from "@clawops/domain";
import { timeAgo } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskList } from "@/components/tasks/task-list";
import { cn } from "@/lib/utils";
import { getIdeaSections, listIdeaTasks } from "@clawops/ideas";
import { getDb } from "@/lib/server/runtime";
import { CreateTaskDialog } from "./create-task-dialog";
import { ideas, eq } from "@clawops/core";

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

const SECTION_ORDER = ["brainstorming", "research", "similarIdeas", "draftPrd", "notes"] as const;
const SECTION_LABELS: Record<string, string> = {
  brainstorming: "Brainstorming",
  research: "Research",
  similarIdeas: "Similar Ideas",
  draftPrd: "Draft PRD",
  notes: "Notes",
};

async function getIdeaData(id: string) {
  const db = getDb();
  
  // Get idea from database
  const [ideaRow] = db
    .select()
    .from(ideas)
    .where(eq(ideas.id, id))
    .all();
  
  if (!ideaRow) {
    return null;
  }
  
  const sections = getIdeaSections(db, id);
  const tasks = listIdeaTasks(db, id);
  
  return { idea: ideaRow as unknown as Idea, sections, tasks };
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

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="space-y-4">
        {/* Back link */}
        <Link
          href="/ideas"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Ideas
        </Link>

        {/* Title and actions */}
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
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <CreateTaskDialog ideaId={id} />
          </div>
        </div>

        {/* Meta info */}
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

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Sections */}
        <div className="lg:col-span-2 space-y-4">
          {SECTION_ORDER.map((sectionKey) => {
            const content = sections[sectionKey];
            if (!content) return null;
            return (
              <Card key={sectionKey}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    {SECTION_LABELS[sectionKey]}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground font-sans">
                    {content}
                  </pre>
                </CardContent>
              </Card>
            );
          })}
          {SECTION_ORDER.every((k) => !sections[k]) && (
            <Card>
              <CardContent className="py-8">
                <div className="flex flex-col items-center justify-center text-center">
                  <Lightbulb className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No sections yet. This idea is in its early stages.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
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
                  tasks={tasks as never[]}
                  showAssignee={false}
                  showProject={false}
                  compact
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
