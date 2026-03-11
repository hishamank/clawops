export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { listOpenClawSessions } from "@clawops/sync";
import { getDb, jsonError, parseSearch, requireAgentId } from "@/lib/server/runtime";

const listSessionsQuery = z.object({
  connectionId: z.string().min(1).optional(),
  status: z.enum(["active", "ended"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(req: Request): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const query = parseSearch(req, listSessionsQuery);
    return NextResponse.json(
      listOpenClawSessions(getDb(), {
        connectionId: query.connectionId,
        status: query.status,
        limit: query.limit,
      }),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }

    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to list OpenClaw sessions",
      "INTERNAL_ERROR",
    );
  }
}
