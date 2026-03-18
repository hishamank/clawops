import { Lightbulb, ListTodo, Archive } from "lucide-react";
import type { Idea } from "@/lib/types";
import type { IdeaStatus, Source } from "@clawops/domain";
import { timeAgo } from "@/lib/time";
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

// ─── Status styles ─────────────────────────────────────────────────────────────

const statusPill: Record<IdeaStatus, string> = {
  raw:      "bg-[#6b7080]/10 text-[#6b7080] border-[#6b7080]/20",
  reviewed: "bg-[#5e6ad2]/10 text-[#5e6ad2] border-[#5e6ad2]/20",
  promoted: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  archived: "bg-[#6b7080]/8 text-[#6b7080]/50 border-[#6b7080]/10",
};

const sourceColors: Record<Source, string> = {
  human:  "text-[#5e6ad2]",
  agent:  "text-amber-400",
  cli:    "text-[#6b7080]",
  script: "text-purple-400",
};

const stageMeta: Record<IdeaStatus, { label: string; color: string; dot: string }> = {
  raw:      { label: "Raw",      color: "text-[#6b7080]",     dot: "bg-[#6b7080]/50"    },
  reviewed: { label: "Reviewed", color: "text-[#5e6ad2]",     dot: "bg-[#5e6ad2]"       },
  promoted: { label: "Promoted", color: "text-emerald-400",   dot: "bg-emerald-500"     },
  archived: { label: "Archived", color: "text-[#6b7080]/50",  dot: "bg-[#6b7080]/30"   },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

interface IdeaWithCount extends Idea { taskCount: number }

// ─── Idea card ────────────────────────────────────────────────────────────────

function IdeaRow({ idea }: { idea: IdeaWithCount }): React.JSX.Element {
  const tags = parseTags(idea.tags);
  return (
    <div className="group relative flex items-start gap-3 rounded-xl border border-white/8 bg-[#0d0d1a] p-4 transition-colors hover:bg-white/[0.03]">
      <Link href={`/ideas/${idea.id}`} className="absolute inset-0 rounded-xl" aria-label={idea.title}><span className="sr-only">{idea.title}</span></Link>

      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#5e6ad2]/10">
        <Lightbulb className="h-3.5 w-3.5 text-[#5e6ad2]" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[#ededef]">{idea.title}</span>
          <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium", statusPill[idea.status])}>
            {idea.status}
          </span>
          <span className={cn("shrink-0 text-[10px]", sourceColors[idea.source])}>
            {idea.source}
          </span>
          {idea.taskCount > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-[#6b7080]">
              <ListTodo className="h-3 w-3" />
              {idea.taskCount}
            </span>
          )}
        </div>

        {idea.description && (
          <p className="mt-1 line-clamp-2 text-xs text-[#6b7080]">{idea.description}</p>
        )}

        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-[#6b7080]">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="relative z-10 flex shrink-0 flex-col items-end gap-2">
        <span className="text-[11px] text-[#6b7080]">{timeAgo(idea.createdAt)}</span>
        {(idea.status === "raw" || idea.status === "reviewed") && (
          <PromoteButton ideaId={idea.id} />
        )}
      </div>
    </div>
  );
}

// ─── Stage section ────────────────────────────────────────────────────────────

function StageSection({ status, ideas }: { status: IdeaStatus; ideas: IdeaWithCount[] }): React.JSX.Element | null {
  if (ideas.length === 0) return null;
  const meta = stageMeta[status];
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <div className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
        <span className={cn("text-xs font-semibold", meta.color)}>{meta.label}</span>
        <span className="font-mono text-[10px] text-[#6b7080]/50">{ideas.length}</span>
      </div>
      {ideas.map((idea) => <IdeaRow key={idea.id} idea={idea} />)}
    </section>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getIdeas(): Promise<IdeaWithCount[]> {
  const db = getDb();
  const ideas = listIdeas(db).map(mapIdea);
  return ideas.map((idea) => ({ ...idea, taskCount: listIdeaTasks(db, idea.id).length }));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function IdeasPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const sp = await searchParams;
  const status = typeof sp?.status === "string" ? sp.status : undefined;

  // Fetch all ideas once; derive filtered view in memory
  const allIdeas = await getIdeas();
  const activeIdeas =
    status && status !== "all"
      ? allIdeas.filter((i) => i.status === status)
      : allIdeas;

  const counts = {
    all:      allIdeas.length,
    raw:      allIdeas.filter((i) => i.status === "raw").length,
    reviewed: allIdeas.filter((i) => i.status === "reviewed").length,
    promoted: allIdeas.filter((i) => i.status === "promoted").length,
    archived: allIdeas.filter((i) => i.status === "archived").length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#ededef]">Ideas</h1>
          <p className="mt-0.5 text-sm text-[#6b7080]">Captured insights from your agent fleet</p>
        </div>
        <CreateIdeaDialog />
      </div>

      {/* Filter tabs */}
      <IdeaFilterTabs current={status ?? "all"} counts={counts} />

      {/* Grouped pipeline view (all) */}
      {(!status || status === "all") && allIdeas.length > 0 && (
        <div className="space-y-6">
          <StageSection status="raw"      ideas={allIdeas.filter((i) => i.status === "raw")}      />
          <StageSection status="reviewed" ideas={allIdeas.filter((i) => i.status === "reviewed")} />
          <StageSection status="promoted" ideas={allIdeas.filter((i) => i.status === "promoted")} />
          <StageSection status="archived" ideas={allIdeas.filter((i) => i.status === "archived")} />
        </div>
      )}

      {/* Filtered flat list */}
      {status && status !== "all" && (
        activeIdeas.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/8 py-14 text-center">
            {status === "archived"
              ? <Archive className="mb-3 h-9 w-9 text-[#6b7080]" />
              : <Lightbulb className="mb-3 h-9 w-9 text-[#6b7080]" />
            }
            <p className="text-sm text-[#6b7080]">No {status} ideas</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeIdeas.map((idea) => <IdeaRow key={idea.id} idea={idea} />)}
          </div>
        )
      )}

      {/* All empty state */}
      {(!status || status === "all") && allIdeas.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/8 py-14 text-center">
          <Lightbulb className="mb-3 h-9 w-9 text-[#6b7080]" />
          <p className="text-sm text-[#6b7080]">No ideas yet</p>
          <p className="mt-1 text-xs text-[#6b7080]/60">Ideas appear here as your agents capture them.</p>
        </div>
      )}
    </div>
  );
}
