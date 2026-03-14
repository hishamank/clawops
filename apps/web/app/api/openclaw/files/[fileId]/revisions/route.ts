export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { listWorkspaceFileRevisions } from "@clawops/sync";
import { getDb, jsonError, requireAgentId } from "@/lib/server/runtime";

const listRevisionsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> },
): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { fileId } = await params;
    const url = new URL(req.url);
    const query = listRevisionsQuery.parse({
      limit: url.searchParams.get("limit") ?? undefined,
    });

    const revisions = listWorkspaceFileRevisions(getDb(), fileId, {
      limit: query.limit,
    });

    return NextResponse.json({ fileId, revisions });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }
    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to list revisions",
      "INTERNAL_ERROR",
    );
  }
}
