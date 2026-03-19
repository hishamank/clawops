"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createActivityEvent, events } from "@clawops/core";
import { ProjectStatus } from "@clawops/domain";
import { createProject } from "@clawops/projects";
import { getDb } from "@/lib/server/runtime";

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  description: z.string().trim().optional(),
  repoUrl: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .refine((value) => !value || /^https?:\/\//.test(value), "Repo URL must start with http or https"),
  directoryPath: z.string().trim().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  prd: z.string().optional(),
  ideaId: z.string().optional(),
});

export interface CreateProjectActionState {
  success?: boolean;
  error?: string;
  projectId?: string;
}

export async function createProjectAction(
  _prevState: CreateProjectActionState | undefined,
  formData: FormData,
): Promise<CreateProjectActionState> {
  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    repoUrl: formData.get("repoUrl"),
    directoryPath: formData.get("directoryPath"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid project input",
    };
  }

  try {
    const db = getDb();
    const project = db.transaction((tx) => {
      const created = createProject(tx, {
        name: parsed.data.name,
        description: parsed.data.description || undefined,
        repoUrl: parsed.data.repoUrl,
        directoryPath: parsed.data.directoryPath || undefined,
      });

      tx.insert(events)
        .values({
          action: "project.created",
          entityType: "project",
          entityId: created.id,
          agentId: null,
          meta: JSON.stringify({ name: created.name }),
        })
        .run();

      createActivityEvent(tx, {
        source: "user",
        type: "project.created",
        title: `Project created: ${created.name}`,
        entityType: "project",
        entityId: created.id,
        projectId: created.id,
        metadata: JSON.stringify({
          name: created.name,
          status: created.status,
        }),
      });

      return created;
    });

    revalidatePath("/projects");
    return { success: true, projectId: project.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create project",
    };
  }
}
