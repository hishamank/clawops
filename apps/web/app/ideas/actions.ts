"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createActivityEvent, events } from "@clawops/core";
import { createIdea } from "@clawops/ideas";
import { getDb } from "@/lib/server/runtime";

const createIdeaSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
  tags: z.string().trim().optional(),
  projectId: z.string().trim().optional(),
});

export interface CreateIdeaActionState {
  success?: boolean;
  error?: string;
  ideaId?: string;
}

function parseTags(tags: string | undefined): string[] | undefined {
  if (!tags) {
    return undefined;
  }

  const parsed = tags
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : undefined;
}

export async function createIdeaAction(
  _prevState: CreateIdeaActionState | undefined,
  formData: FormData,
): Promise<CreateIdeaActionState> {
  const parsed = createIdeaSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    tags: formData.get("tags"),
    projectId: formData.get("projectId"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid idea input",
    };
  }

  try {
    const db = getDb();
    const idea = db.transaction((tx) => {
      const created = createIdea(tx, {
        title: parsed.data.title,
        description: parsed.data.description || undefined,
        tags: parseTags(parsed.data.tags),
        source: "human",
        projectId: parsed.data.projectId || undefined,
      });

      tx.insert(events)
        .values({
          action: "idea.created",
          entityType: "idea",
          entityId: created.id,
          agentId: null,
          meta: JSON.stringify({ title: created.title }),
        })
        .run();

      createActivityEvent(tx, {
        source: "user",
        type: "idea.created",
        title: `Idea created: ${created.title}`,
        entityType: "idea",
        entityId: created.id,
        metadata: JSON.stringify({
          title: created.title,
          source: "human",
        }),
      });

      return created;
    });

    revalidatePath("/ideas");
    return { success: true, ideaId: idea.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create idea",
    };
  }
}
