import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, GitBranch, GitCommitHorizontal, Clock, HardDrive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import { getDb } from "@/lib/server/runtime";
import { eq, workspaceFiles, workspaceFileRevisions } from "@clawops/core";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compare Revisions",
  description: "Compare two file revisions side by side",
};

function formatTimestamp(date: Date | null): string {
  if (!date) return "unknown";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "--";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderTimeAgo(value?: Date | null): string {
  return timeAgo(value ? value.toISOString() : null);
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  leftNum: number | null;
  rightNum: number | null;
  text: string;
}

function computeSimpleDiff(leftContent: string, rightContent: string): DiffLine[] {
  const leftLines = leftContent.split("\n");
  const rightLines = rightContent.split("\n");
  const lines: DiffLine[] = [];

  let leftIdx = 0;
  let rightIdx = 0;

  // Simple LCS-based approach: find common lines and mark differences
  const lcs = computeLCS(leftLines, rightLines);
  let lcsIdx = 0;

  while (leftIdx < leftLines.length || rightIdx < rightLines.length) {
    if (
      lcsIdx < lcs.length &&
      leftIdx < leftLines.length &&
      rightIdx < rightLines.length &&
      leftLines[leftIdx] === lcs[lcsIdx] &&
      rightLines[rightIdx] === lcs[lcsIdx]
    ) {
      lines.push({
        type: "unchanged",
        leftNum: leftIdx + 1,
        rightNum: rightIdx + 1,
        text: leftLines[leftIdx]!,
      });
      leftIdx++;
      rightIdx++;
      lcsIdx++;
    } else if (
      leftIdx < leftLines.length &&
      (lcsIdx >= lcs.length || leftLines[leftIdx] !== lcs[lcsIdx])
    ) {
      lines.push({
        type: "removed",
        leftNum: leftIdx + 1,
        rightNum: null,
        text: leftLines[leftIdx]!,
      });
      leftIdx++;
    } else if (rightIdx < rightLines.length) {
      lines.push({
        type: "added",
        leftNum: null,
        rightNum: rightIdx + 1,
        text: rightLines[rightIdx]!,
      });
      rightIdx++;
    }
  }

  return lines;
}

function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  // For large files, truncate to avoid performance issues
  if (m > 2000 || n > 2000) {
    return [];
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]!);
      i--;
      j--;
    } else if (dp[i - 1]![j]! > dp[i]![j - 1]!) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

function RevisionCard({
  label,
  revision,
}: {
  label: string;
  revision: {
    id: string;
    hash: string | null;
    sizeBytes: number | null;
    gitCommitSha: string | null;
    gitBranch: string | null;
    source: string;
    capturedAt: Date;
    content: string | null;
  };
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatTimestamp(revision.capturedAt)}
          <span className="ml-1 text-muted-foreground/70">
            ({renderTimeAgo(revision.capturedAt)})
          </span>
        </div>
        {revision.gitBranch && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <GitBranch className="h-3 w-3" />
            {revision.gitBranch}
          </div>
        )}
        {revision.gitCommitSha && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <GitCommitHorizontal className="h-3 w-3" />
            <code>{revision.gitCommitSha.slice(0, 8)}</code>
          </div>
        )}
        {revision.hash && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <HardDrive className="h-3 w-3" />
            <code>{revision.hash.slice(0, 16)}</code>
          </div>
        )}
        <div className="text-muted-foreground">
          Size: {formatBytes(revision.sizeBytes)} &middot; Source: {revision.source}
        </div>
        {revision.content != null && (
          <Badge variant="outline" className="text-xs text-emerald-500">
            Content available
          </Badge>
        )}
        {revision.content == null && (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Metadata only
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

const diffLineStyles: Record<string, string> = {
  added: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  removed: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  unchanged: "",
};

const diffLinePrefixes: Record<string, string> = {
  added: "+",
  removed: "-",
  unchanged: " ",
};

export default async function CompareRevisionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ fileId: string }>;
  searchParams: Promise<{ left?: string; right?: string }>;
}): Promise<React.JSX.Element> {
  const { fileId } = await params;
  const { left: leftId, right: rightId } = await searchParams;
  const db = getDb();

  const file = db
    .select()
    .from(workspaceFiles)
    .where(eq(workspaceFiles.id, fileId))
    .get();

  if (!file) {
    notFound();
  }

  if (!leftId || !rightId) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <Link
            href={`/openclaw/files/${fileId}`}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Compare revisions</h1>
            <p className="text-sm text-muted-foreground">{file.relativePath}</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-8">
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Select two revisions to compare. Go back to the{" "}
              <Link href={`/openclaw/files/${fileId}`} className="underline hover:text-foreground">
                revision list
              </Link>{" "}
              and use the quick compare links.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const leftRevision = db
    .select()
    .from(workspaceFileRevisions)
    .where(eq(workspaceFileRevisions.id, leftId))
    .get();

  const rightRevision = db
    .select()
    .from(workspaceFileRevisions)
    .where(eq(workspaceFileRevisions.id, rightId))
    .get();

  if (!leftRevision || !rightRevision) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <Link
            href={`/openclaw/files/${fileId}`}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Compare revisions</h1>
            <p className="text-sm text-muted-foreground">{file.relativePath}</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-8">
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              One or both revisions were not found. They may have been removed during a cleanup.{" "}
              <Link href={`/openclaw/files/${fileId}`} className="underline hover:text-foreground">
                Back to revision list
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hashesMatch = leftRevision.hash != null && leftRevision.hash === rightRevision.hash;
  const bothHaveContent = leftRevision.content != null && rightRevision.content != null;
  const diffLines = bothHaveContent
    ? computeSimpleDiff(leftRevision.content!, rightRevision.content!)
    : null;
  const addedCount = diffLines?.filter((l) => l.type === "added").length ?? 0;
  const removedCount = diffLines?.filter((l) => l.type === "removed").length ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Link
          href={`/openclaw/files/${fileId}`}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compare revisions</h1>
          <p className="text-sm text-muted-foreground">{file.relativePath}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <RevisionCard label="Left (older)" revision={leftRevision} />
        <RevisionCard label="Right (newer)" revision={rightRevision} />
      </div>

      {/* Metadata comparison summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Metadata comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-muted-foreground">Hash match</span>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  hashesMatch ? "text-emerald-500" : "text-amber-500",
                )}
              >
                {hashesMatch ? "Identical" : "Different"}
              </Badge>
            </div>
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-muted-foreground">Size change</span>
              <span className="text-xs font-medium">
                {formatBytes(leftRevision.sizeBytes)} &rarr;{" "}
                {formatBytes(rightRevision.sizeBytes)}
                {leftRevision.sizeBytes != null &&
                  rightRevision.sizeBytes != null &&
                  leftRevision.sizeBytes !== rightRevision.sizeBytes && (
                    <span
                      className={cn(
                        "ml-1",
                        rightRevision.sizeBytes > leftRevision.sizeBytes
                          ? "text-emerald-500"
                          : "text-rose-500",
                      )}
                    >
                      ({rightRevision.sizeBytes > leftRevision.sizeBytes ? "+" : ""}
                      {rightRevision.sizeBytes - leftRevision.sizeBytes} B)
                    </span>
                  )}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-muted-foreground">Git branch</span>
              <span className="text-xs">
                {leftRevision.gitBranch ?? "--"} &rarr; {rightRevision.gitBranch ?? "--"}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2">
              <span className="text-muted-foreground">Git commit</span>
              <span className="text-xs">
                <code>{leftRevision.gitCommitSha?.slice(0, 8) ?? "--"}</code> &rarr;{" "}
                <code>{rightRevision.gitCommitSha?.slice(0, 8) ?? "--"}</code>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content diff */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm">
            <span>Content diff</span>
            {diffLines && (
              <span className="text-xs font-normal text-muted-foreground">
                <span className="text-emerald-500">+{addedCount}</span>{" "}
                <span className="text-rose-500">-{removedCount}</span>
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hashesMatch ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              File content is identical between these two revisions (same hash).
            </div>
          ) : !bothHaveContent ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Content comparison is not available. File content is captured when files are written
              through the action API. Only metadata (hash, size, Git context) was recorded for these
              revisions.
            </div>
          ) : diffLines && diffLines.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No differences found in file content.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs font-mono">
                <tbody>
                  {diffLines?.map((line, idx) => (
                    <tr
                      key={idx}
                      className={cn(
                        "border-b border-border/30 last:border-0",
                        diffLineStyles[line.type],
                      )}
                    >
                      <td className="w-12 select-none px-2 py-0.5 text-right text-muted-foreground/50">
                        {line.leftNum ?? ""}
                      </td>
                      <td className="w-12 select-none px-2 py-0.5 text-right text-muted-foreground/50">
                        {line.rightNum ?? ""}
                      </td>
                      <td className="w-4 select-none px-1 py-0.5 text-center font-bold">
                        {diffLinePrefixes[line.type]}
                      </td>
                      <td className="whitespace-pre px-2 py-0.5">{line.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
