export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { TaskPriority } from "@clawops/domain";
import { getPullableTasks } from "@clawops/tasks";
import { getDb, jsonError, parseSearch, requireAgentId } from "@/lib/server/runtime";

const taskPriorityEnum = z.nativeEnum(TaskPriority);

const listPullableTasksQuery = z.object({
  projectId: z.string().optional(),
  priority: taskPriorityEnum.optional(),
  templateId: z.string().optional(),
  stageId: z.string().optional(),
});

export async function GET(req: Request): Promise<NextResponse> {
  const auth = requireAgentId(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const filters = parseSearch(req, listPullableTasksQuery);
    return NextResponse.json(getPullableTasks(getDb(), filters));
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(400, err.message, "VALIDATION_ERROR");
    return jsonError(500, err instanceof Error ? err.message : "Failed to get pullable tasks", "INTERNAL_ERROR");
  }
}
