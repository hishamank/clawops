import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, GitBranch, GitCommitHorizontal, Clock, HardDrive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import { getDb } from "@/lib/server/runtime";
import { eq, workspaceFiles, type WorkspaceFile } from "@clawops/core";
import { listWorkspaceFileRevisions, type WorkspaceFileRevision } from "@clawops/sync";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "File Revisions",
  description: "View revision history for a tracked workspace file",
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

function RevisionRow({
  revision,
  index,
}: {
  revision: WorkspaceFileRevision;
  index: number;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border px-4 py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            #{index + 1}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {renderTimeAgo(revision.capturedAt)}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          <Clock className="mr-1 inline h-3 w-3" />
          {formatTimestamp(revision.capturedAt)}
        </p>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {revision.gitBranch && (
            <span className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {revision.gitBranch}
            </span>
          )}
          {revision.gitCommitSha && (
            <span className="flex items-center gap-1">
              <GitCommitHorizontal className="h-3 w-3" />
              <code>{revision.gitCommitSha.slice(0, 8)}</code>
            </span>
          )}
          {revision.hash && (
            <span className="flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              <code>{revision.hash.slice(0, 12)}</code>
            </span>
          )}
          {revision.sizeBytes != null && (
            <span>{formatBytes(revision.sizeBytes)}</span>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Source: <span className="font-medium">{revision.source}</span>
        </p>
      </div>
    </div>
  );
}

export default async function FileDetailPage({
  params,
}: {
  params: Promise<{ fileId: string }>;
}): Promise<React.JSX.Element> {
  const { fileId } = await params;
  const db = getDb();

  const file: WorkspaceFile | undefined = db
    .select()
    .from(workspaceFiles)
    .where(eq(workspaceFiles.id, fileId))
    .get();

  if (!file) {
    notFound();
  }

  const revisions = listWorkspaceFileRevisions(db, fileId);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Link
          href="/openclaw"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {file.relativePath}
          </h1>
          <p className="text-sm text-muted-foreground">
            {file.workspacePath} &middot; Last seen {renderTimeAgo(file.lastSeenAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current hash
            </CardTitle>
          </CardHeader>
          <CardContent>
            <code className="text-sm">
              {file.fileHash ? file.fileHash.slice(0, 16) : "--"}
            </code>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold">{formatBytes(file.sizeBytes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revisions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold">{revisions.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Revision history</CardTitle>
          {revisions.length >= 2 && (
            <Link
              href={`/openclaw/files/${fileId}/compare?left=${revisions[1]!.id}&right=${revisions[0]!.id}`}
              className={cn(
                "inline-flex items-center rounded-md border border-border px-3 py-1.5",
                "text-xs font-medium transition-colors hover:bg-accent",
              )}
            >
              Compare latest
            </Link>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {revisions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No revisions recorded yet. Revisions are created automatically when file changes are
              detected during sync.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {revisions.map((revision, index) => (
                  <RevisionRow
                    key={revision.id}
                    revision={revision}
                    index={revisions.length - 1 - index}
                  />
                ))}
              </div>

              {revisions.length >= 2 && (
                <div className="pt-4">
                  <h3 className="mb-3 text-sm font-medium">Quick compare</h3>
                  <div className="space-y-2">
                    {revisions.slice(0, -1).map((revision, idx) => {
                      const older = revisions[idx + 1];
                      if (!older) return null;
                      return (
                        <Link
                          key={revision.id}
                          href={`/openclaw/files/${fileId}/compare?left=${older.id}&right=${revision.id}`}
                          className="flex items-center justify-between rounded-lg border border-border px-4 py-2 text-xs transition-colors hover:bg-accent"
                        >
                          <span>
                            Rev #{revisions.length - 1 - (idx + 1)} &rarr; Rev #{revisions.length - 1 - idx}
                          </span>
                          <span className="text-muted-foreground">
                            {renderTimeAgo(older.capturedAt)} &rarr;{" "}
                            {renderTimeAgo(revision.capturedAt)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
