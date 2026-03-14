"use server";

import { revalidatePath } from "next/cache";
import { revertTrackedOpenClawFile, OpenClawActionError } from "@clawops/sync/openclaw";
import { events, createActivityEvent, type DB } from "@clawops/core";
import { getDb } from "@/lib/server/runtime";

export async function revertFileRevisionAction(
  revisionId: string,
  fileId: string,
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();

  try {
    const result = await revertTrackedOpenClawFile(db, {
      revisionId,
      source: "operator",
    });

    db.transaction((tx) => {
      tx.insert(events)
        .values({
          action: "file.reverted",
          entityType: "workspace_file_revision",
          entityId: revisionId,
          meta: JSON.stringify({ relativePath: result.file.relativePath, fileId: result.file.id }),
        })
        .run();

      createActivityEvent(tx as unknown as DB, {
        source: "user",
        severity: "info",
        type: "file.reverted",
        title: `File reverted: ${result.file.relativePath}`,
        entityType: "workspace_file",
        entityId: result.file.id,
        metadata: JSON.stringify({ revisionId, relativePath: result.file.relativePath }),
      });
    });

    revalidatePath(`/openclaw/files/${fileId}`);
    return { success: true };
  } catch (err) {
    if (err instanceof OpenClawActionError) {
      try {
        createActivityEvent(db, {
          source: "user",
          severity: "error",
          type: "file.revert_failed",
          title: `File revert failed`,
          metadata: JSON.stringify({ revisionId, fileId, error: err.message, code: err.code }),
        });
      } catch {
        // ignore audit failure
      }
      return { success: false, error: err.message };
    }

    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to revert file",
    };
  }
}
