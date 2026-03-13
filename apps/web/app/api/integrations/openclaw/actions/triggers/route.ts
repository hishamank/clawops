export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { triggerSupportedOpenClawEndpoint } from "@clawops/sync/openclaw";
import { getDb, isNotFoundError, jsonError, requireAgentId } from "@/lib/server/runtime";

const triggerBodySchema = z.object({
  connectionId: z.string().min(1),
  endpoint: z.string().min(1),
  body: z.record(z.string(), z.unknown()).optional(),
  gatewayToken: z.string().min(1).optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = triggerBodySchema.parse(await req.json());
    const result = await triggerSupportedOpenClawEndpoint(getDb(), {
      actorAgentId: auth,
      source: "api",
      connectionId: body.connectionId,
      endpoint: body.endpoint,
      body: body.body,
      gatewayToken:
        body.gatewayToken
        ?? req.headers.get("x-openclaw-gateway-token")
        ?? undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }

    if (isNotFoundError(err)) {
      return jsonError(404, err instanceof Error ? err.message : "Not found", "NOT_FOUND");
    }

    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to trigger OpenClaw endpoint",
      "INTERNAL_ERROR",
    );
  }
}
