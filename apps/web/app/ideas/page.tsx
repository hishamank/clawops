import { Lightbulb, Sparkles, ArrowUpRight, ListTodo } from "lucide-react";
import type { Idea } from "@/lib/types";
import type { IdeaStatus, Source } from "@clawops/domain";
import { timeAgo } from "@/lib/time";
import { StatsCard } from "@/components/stats-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { IdeaFilterTabs } from "./filter-tabs";
import { PromoteButton } from "./promote-button";
import { CreateIdeaDialog } from "./create-idea-dialog";
import { listIdeas, listIdeaTasks } from "@clawops/ideas";
import { getDb } from "@/lib/server/runtime";
import { mapIdea } from "@/lib/mappers";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
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

interface IdeaWithTaskCount extends Idea {
  taskCount: number;
}

async function getIdeas(status?: string): Promise<IdeaWithTaskCount[]> {
  const db = getDb();
  const ideas = listIdeas(
    db,
    status && status !== "all" ? { status: status as IdeaStatus } : undefined,
  ).map(mapIdea);
  
  // Get task counts for each idea
  const ideasWithCounts: IdeaWithTaskCount[] = ideas.map((idea) => ({
    ...idea,
    taskCount: listIdeaTasks(db, idea.id).length,
  }));
  
  return ideasWithCounts;
}

export default async function IdeasPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const resolvedParams = await searchParams;
  const status = typeof resolvedParams?.status === "string" ? resolvedParams.status : undefined;
  const ideas = await getIdeas(status);

  const raw = ideas.filter((i) => i.status === "raw").length;
  const promoted = ideas.filter((i) => i.status === "promoted").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Ideas</h1>
          <p className="mt-1 text-muted-foreground">
            Captured insights from your agent fleet
          </p>
        </div>
        <CreateIdeaDialog />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title="Total Ideas"
          value={ideas.length}
          icon={Lightbulb}
          description="All ideas"
        />
        <StatsCard
          title="Raw"
          value={raw}
          icon={Sparkles}
          description="Unreviewed"
        />
        <StatsCard
          title="Promoted"
          value={promoted}
          icon={ArrowUpRight}
          description="Became projects"
        />
      </div>

      {/* Filter tabs */}
      <IdeaFilterTabs current={status ?? "all"} />

      {/* Ideas list */}
      {ideas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Lightbulb className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No ideas yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ideas will appear here as your agents capture them.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {ideas.map((idea) => {
            const tags = parseTags(idea.tags);
            return (
              <Card key={idea.id} className="transition-colors hover:bg-accent/50">
                <CardContent className="py-3">
                  <Link href={`/ideas/${idea.id}`} className="block">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">
                            {idea.title}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(ideaStatusStyles[idea.status], "shrink-0")}
                          >
                            {ideaStatusLabels[idea.status]}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(sourceStyles[idea.source], "shrink-0")}
                          >
                            {idea.source}
                          </Badge>
                          {idea.taskCount > 0 && (
                            <Badge
                              variant="outline"
                              className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20 shrink-0"
                            >
                              <ListTodo className="h-3 w-3 mr-1" />
                              {idea.taskCount} task{idea.taskCount !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                        {idea.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {idea.description}
                          </p>
                        )}
                        {tags.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(idea.createdAt)}
                        </span>
                        {(idea.status === "raw" || idea.status === "reviewed") && (
                          <PromoteButton ideaId={idea.id} />
                        )}
                      </div>
                    </div>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
