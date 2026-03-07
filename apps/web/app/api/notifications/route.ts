export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { listNotifications } from "@clawops/notifications";
import { getDb, jsonError, parseSearch } from "@/lib/server/runtime";

const listQuery = z.object({
  read: z.enum(["true", "false"]).optional(),
});

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const { read } = parseSearch(req, listQuery);
    const parsedRead = read === undefined ? undefined : read === "true";
    const list = listNotifications(getDb(), parsedRead === undefined ? undefined : { read: parsedRead });
    return NextResponse.json(list);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, err.message, "VALIDATION_ERROR");
    }
    return jsonError(500, err instanceof Error ? err.message : "Failed to fetch notifications", "INTERNAL_ERROR");
  }
}
