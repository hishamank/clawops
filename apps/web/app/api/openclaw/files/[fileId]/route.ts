export const dynamic = "force-dynamic";

import { eq, workspaceFiles } from "@clawops/core";
import { NextResponse } from "next/server";
import { getDb, jsonError, requireAgentId } from "@/lib/server/runtime";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> },
): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { fileId } = await params;
    const file = getDb()
      .select()
      .from(workspaceFiles)
      .where(eq(workspaceFiles.id, fileId))
      .get();

    if (!file) {
      return jsonError(404, "File not found", "NOT_FOUND");
    }

    return NextResponse.json(file);
  } catch (err) {
    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to load file",
      "INTERNAL_ERROR",
    );
  }
}
