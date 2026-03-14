export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { writeTrackedOpenClawFile } from "@clawops/sync/openclaw";
import { getDb, isNotFoundError, jsonError, requireAgentId } from "@/lib/server/runtime";

const writeFileBodySchema = z.object({
  connectionId: z.string().min(1),
  relativePath: z.string().min(1),
  content: z.string(),
  workspacePath: z.string().min(1).optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const gatewayToken = req.headers.get("x-openclaw-gateway-token") ?? undefined;

  try {
    const body = writeFileBodySchema.parse(await req.json());
    const file = await writeTrackedOpenClawFile(getDb(), {
      actorAgentId: auth,
      source: "api",
      connectionId: body.connectionId,
      relativePath: body.relativePath,
      content: body.content,
      workspacePath: body.workspacePath,
      gatewayToken,
    });

    return NextResponse.json(file);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }

    if (isNotFoundError(err)) {
      return jsonError(404, err instanceof Error ? err.message : "Not found", "NOT_FOUND");
    }

    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to write tracked workspace file",
      "INTERNAL_ERROR",
    );
  }
}
