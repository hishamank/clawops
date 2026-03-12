export const dynamic = "force-dynamic";

import {
  and,
  desc,
  eq,
  gte,
  workspaceFiles,
  type WorkspaceFile,
} from "@clawops/core";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, jsonError, requireAgentId } from "@/lib/server/runtime";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const PRESENT_WINDOW_MS = 24 * 60 * 60 * 1000;

const workspaceFilesQuery = z.object({
  connectionId: z.string().min(1),
  changedOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  presentOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value !== "false"),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
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
      presentOnly: url.searchParams.get("presentOnly") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      offset: url.searchParams.get("offset") ?? undefined,
    });

    const presentThreshold = new Date(Date.now() - PRESENT_WINDOW_MS);
    const whereClause = query.presentOnly
      ? and(
          eq(workspaceFiles.connectionId, query.connectionId),
          gte(workspaceFiles.lastSeenAt, presentThreshold),
        )
      : eq(workspaceFiles.connectionId, query.connectionId);

    const rows = getDb()
      .select()
      .from(workspaceFiles)
      .where(whereClause)
      .orderBy(desc(workspaceFiles.lastSeenAt), workspaceFiles.relativePath)
      .limit(query.limit)
      .offset(query.offset)
      .all();

    const files = query.changedOnly ? rows.filter(wasChangedInLatestSync) : rows;

    return NextResponse.json({
      connectionId: query.connectionId,
      changedOnly: query.changedOnly,
      presentOnly: query.presentOnly,
      limit: query.limit,
      offset: query.offset,
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
