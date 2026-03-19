"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createActivityEvent, events, parseJsonObject } from "@clawops/core";
import { getOpenClawConnection, updateOpenClawConnection } from "@clawops/sync";
import { getDb } from "@/lib/server/runtime";

const gatewayTokenSchema = z.object({
  gatewayToken: z
    .string()
    .trim()
    .min(1, "Gateway token is required.")
    .max(4096, "Gateway token is too long."),
});

export interface UpdateOpenClawGatewayTokenState {
  success?: boolean;
  error?: string;
  message?: string;
}

export async function updateOpenClawGatewayTokenAction(
  connectionId: string,
  _prevState: UpdateOpenClawGatewayTokenState | undefined,
  formData: FormData,
): Promise<UpdateOpenClawGatewayTokenState> {
  const parsed = gatewayTokenSchema.safeParse({
    gatewayToken: formData.get("gatewayToken"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid gateway token.",
    };
  }

  const db = getDb();
  const connection = getOpenClawConnection(db, connectionId);
  if (!connection) {
    return { success: false, error: "OpenClaw connection not found." };
  }

  try {
    db.transaction((tx) => {
      const updated = updateOpenClawConnection(tx, connectionId, {
        hasGatewayToken: true,
        meta: {
          ...parseJsonObject(connection.meta),
          gatewayToken: parsed.data.gatewayToken,
        },
      });

      if (!updated) {
        throw new Error("OpenClaw connection not found.");
      }

      tx.insert(events)
        .values({
          id: crypto.randomUUID(),
          action: "openclaw.connection.updated",
          entityType: "openclaw_connection",
          entityId: connectionId,
          meta: JSON.stringify({
            fields: ["gatewayToken"],
            source: "settings",
          }),
          createdAt: new Date(),
        })
        .run();

      createActivityEvent(tx, {
        source: "user",
        severity: "info",
        type: "openclaw.connection.updated",
        title: "OpenClaw gateway token updated",
        entityType: "openclaw_connection",
        entityId: connectionId,
        metadata: JSON.stringify({
          fields: ["gatewayToken"],
          source: "settings",
        }),
      });
    });

    revalidatePath("/settings");
    revalidatePath("/openclaw");

    return {
      success: true,
      message: connection.gatewayUrl
        ? "Gateway token saved."
        : "Gateway token saved. This connection still needs a gateway URL before sync actions can run.",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save gateway token.",
    };
  }
}
