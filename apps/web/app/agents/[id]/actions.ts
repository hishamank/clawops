"use server";

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAgent, getOpenClawMappingByAgentId, updateAgentAvatar } from "@clawops/agents";
import {
  and,
  createActivityEvent,
  desc,
  eq,
  events,
  workspaceFileRevisions,
  workspaceFiles,
} from "@clawops/core";
import { OpenClawActionError, writeTrackedOpenClawFile } from "@clawops/sync/openclaw";
import { getDb } from "@/lib/server/runtime";

const avatarSchema = z.object({
  avatar: z
    .string()
    .trim()
    .max(2048, "Avatar is too long")
    .optional()
    .transform((value) => {
      const normalized = value?.trim() ?? "";
      return normalized ? normalized : null;
    }),
});

export interface UpdateAgentAvatarState {
  success?: boolean;
  error?: string;
  message?: string;
}

function updateIdentityAvatarContent(
  existingContent: string,
  agentName: string,
  avatar: string | null,
): string {
  const baseContent = existingContent.trim()
    ? existingContent
    : `# IDENTITY\n- **Name:** ${agentName}\n`;

  let nextContent = baseContent;

  if (/\*\*Avatar:\*\*/.test(nextContent)) {
    nextContent = avatar
      ? nextContent.replace(/^\s*-\s*\*\*Avatar:\*\*.*$/m, `- **Avatar:** ${avatar}`)
      : nextContent.replace(/^\s*-\s*\*\*Avatar:\*\*.*$\n?/m, "");
  } else if (avatar) {
    nextContent = `${nextContent.replace(/\s*$/, "")}\n- **Avatar:** ${avatar}\n`;
  }

  if (!/\*\*Name:\*\*/.test(nextContent)) {
    nextContent = `${nextContent.replace(/\s*$/, "")}\n- **Name:** ${agentName}\n`;
  }

  return `${nextContent.replace(/\s*$/, "")}\n`;
}

function getLatestIdentityContent(connectionId: string): string {
  const db = getDb();
  const file = db
    .select()
    .from(workspaceFiles)
    .where(
      and(
        eq(workspaceFiles.connectionId, connectionId),
        eq(workspaceFiles.relativePath, "IDENTITY.md"),
      ),
    )
    .get();

  if (!file) {
    return "";
  }

  const revision = db
    .select()
    .from(workspaceFileRevisions)
    .where(eq(workspaceFileRevisions.workspaceFileId, file.id))
    .orderBy(desc(workspaceFileRevisions.capturedAt))
    .limit(1)
    .get();

  return typeof revision?.content === "string" ? revision.content : "";
}

async function writeLocalOpenClawIdentityFile(
  workspacePath: string,
  content: string,
): Promise<void> {
  const identityPath = path.join(workspacePath, "IDENTITY.md");
  await fs.writeFile(identityPath, content, "utf8");
}

export async function updateAgentAvatarAction(
  agentId: string,
  _prevState: UpdateAgentAvatarState | undefined,
  formData: FormData,
): Promise<UpdateAgentAvatarState> {
  const db = getDb();
  const agent = getAgent(db, agentId);
  if (!agent) {
    return { success: false, error: "Agent not found." };
  }

  const parsed = avatarSchema.safeParse({
    avatar: formData.get("avatar"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid avatar value." };
  }

  const avatar = parsed.data.avatar;
  const openclawMapping = getOpenClawMappingByAgentId(db, agentId);
  let syncedToOpenClaw = false;
  let syncSkippedReason: string | null = null;

  try {
    if (openclawMapping) {
      try {
        const nextIdentity = updateIdentityAvatarContent(
          getLatestIdentityContent(openclawMapping.connectionId),
          agent.name,
          avatar,
        );
        if (openclawMapping.workspacePath) {
          await writeLocalOpenClawIdentityFile(
            openclawMapping.workspacePath,
            nextIdentity,
          );
        } else {
          await writeTrackedOpenClawFile(db, {
            source: "operator",
            connectionId: openclawMapping.connectionId,
            relativePath: "IDENTITY.md",
            content: nextIdentity,
            workspacePath: openclawMapping.workspacePath ?? undefined,
          });
        }
        syncedToOpenClaw = true;
      } catch (error) {
        if (
          error instanceof OpenClawActionError &&
          (error.code === "OPENCLAW_GATEWAY_TOKEN_MISSING" ||
            error.code === "OPENCLAW_GATEWAY_URL_MISSING")
        ) {
          syncSkippedReason = error.message;
        } else {
          throw error;
        }
      }
    }

    db.transaction((tx) => {
      updateAgentAvatar(tx, agentId, avatar);

      tx.insert(events)
        .values({
          id: crypto.randomUUID(),
          agentId,
          action: "agent.avatar.updated",
          entityType: "agent",
          entityId: agentId,
          meta: JSON.stringify({
            avatar,
            syncedToOpenClaw,
            syncSkippedReason,
          }),
          createdAt: new Date(),
        })
        .run();

      createActivityEvent(tx, {
        source: "user",
        severity: "info",
        type: "agent.avatar.updated",
        title: `Agent avatar updated`,
        agentId,
        entityType: "agent",
        entityId: agentId,
        metadata: JSON.stringify({
          avatar,
          syncedToOpenClaw,
          syncSkippedReason,
        }),
      });
    });

    revalidatePath("/");
    revalidatePath(`/agents/${agentId}`);
    revalidatePath("/activity");

    return {
      success: true,
      message: syncedToOpenClaw
        ? "Avatar updated in ClawOps and OpenClaw."
        : syncSkippedReason
          ? `Avatar updated in ClawOps. OpenClaw sync skipped: ${syncSkippedReason}.`
          : "Avatar updated in ClawOps.",
    };
  } catch (err) {
    if (err instanceof OpenClawActionError) {
      return { success: false, error: err.message };
    }

    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update avatar.",
    };
  }
}
