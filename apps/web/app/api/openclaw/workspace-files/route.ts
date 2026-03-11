export const dynamic = "force-dynamic";

import { desc, eq, workspaceFiles, type WorkspaceFile } from "@clawops/core";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, jsonError, requireAgentId } from "@/lib/server/runtime";

const workspaceFilesQuery = z.object({
  connectionId: z.string().min(1),
  changedOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

function wasChangedInLatestSync(file: WorkspaceFile): boolean {
  return file.updatedAt.getTime() === file.lastSeenAt.getTime();
}

export async function GET(req: Request): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const url = new URL(req.url);
    const query = workspaceFilesQuery.parse({
      connectionId: url.searchParams.get("connectionId"),
      changedOnly: url.searchParams.get("changedOnly") ?? undefined,
    });

    const rows = getDb()
      .select()
      .from(workspaceFiles)
      .where(eq(workspaceFiles.connectionId, query.connectionId))
      .orderBy(desc(workspaceFiles.lastSeenAt), workspaceFiles.relativePath)
      .all();

    const files = query.changedOnly
      ? rows.filter(wasChangedInLatestSync)
      : rows;

    return NextResponse.json({
      connectionId: query.connectionId,
      changedOnly: query.changedOnly,
      count: files.length,
      files: files.map((file) => ({
        ...file,
        changed: wasChangedInLatestSync(file),
      })),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }

    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to load workspace files",
      "INTERNAL_ERROR",
    );
  }
}
