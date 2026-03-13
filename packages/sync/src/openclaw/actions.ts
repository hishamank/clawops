import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  and,
  createActivityEvent,
  eq,
  events,
  openclawConnections,
  workspaceFileRevisions,
  workspaceFiles,
  type DB,
  type Habit,
  type OpenClawConnection,
  type WorkspaceFile,
} from "@clawops/core";
import {
  getCronJob,
  updateConnectionCronJob,
  type OpenClawCronJob,
  type UpdateCronJobPatch,
} from "@clawops/habits";

const TRIGGER_PATH_PREFIXES = ["/api/actions/", "/api/hooks/", "/api/triggers/"] as const;

export interface OpenClawActionAuditInput {
  actorAgentId?: string | null;
  source?: "api" | "cli" | "workflow" | "operator" | "system";
}

export interface UpdateOpenClawCronActionInput extends OpenClawActionAuditInput {
  cronJobId: string;
  patch: UpdateCronJobPatch;
  gatewayToken?: string;
}

export interface WriteTrackedOpenClawFileInput extends OpenClawActionAuditInput {
  connectionId: string;
  relativePath: string;
  content: string;
  workspacePath?: string;
}

export interface TriggerSupportedOpenClawEndpointInput extends OpenClawActionAuditInput {
  connectionId: string;
  endpoint: string;
  body?: Record<string, unknown>;
  gatewayToken?: string;
}

export interface TriggerSupportedOpenClawEndpointResult {
  status: number;
  response: unknown;
}

type TransactionDb = Parameters<DB["transaction"]>[0] extends (tx: infer T) => unknown ? T : DB;

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function toAuditSource(
  value: OpenClawActionAuditInput["source"],
): "system" | "agent" | "workflow" {
  if (value === "api" || value === "cli" || value === "operator") {
    return "agent";
  }
  if (value === "workflow") {
    return "workflow";
  }
  return "system";
}

function getConnectionOrThrow(db: DB, connectionId: string): OpenClawConnection {
  const connection = db
    .select()
    .from(openclawConnections)
    .where(eq(openclawConnections.id, connectionId))
    .get();

  if (!connection) {
    throw new Error(`OpenClaw connection "${connectionId}" not found`);
  }

  return connection;
}

function logLowLevelEvent(
  db: DB,
  input: {
    agentId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    meta: Record<string, unknown>;
  },
): void {
  db.insert(events)
    .values({
      agentId: input.agentId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      meta: JSON.stringify(input.meta),
      createdAt: new Date(),
    })
    .run();
}

function logActivityEvent(
  db: DB,
  input: {
    actorAgentId?: string | null;
    source?: OpenClawActionAuditInput["source"];
    type: string;
    title: string;
    body?: string | null;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
    severity?: "info" | "warning" | "error";
  },
): void {
  createActivityEvent(db, {
    source: toAuditSource(input.source),
    severity: input.severity ?? "info",
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    agentId: input.actorAgentId ?? null,
    metadata: JSON.stringify(input.metadata),
  });
}

function normalizeRelativePath(relativePath: string): string {
  const trimmed = relativePath.trim();
  if (!trimmed) {
    throw new Error("relativePath is required");
  }

  const normalized = path.posix.normalize(trimmed.replaceAll("\\", "/"));
  if (
    !normalized ||
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.startsWith("/")
  ) {
    throw new Error(`relativePath "${relativePath}" is not allowed`);
  }

  return normalized;
}

function resolveTrackedFileTarget(
  db: DB,
  input: WriteTrackedOpenClawFileInput,
): {
  connection: OpenClawConnection;
  existing: WorkspaceFile | null;
  normalizedRelativePath: string;
  workspacePath: string;
  absolutePath: string;
} {
  const connection = getConnectionOrThrow(db, input.connectionId);
  const normalizedRelativePath = normalizeRelativePath(input.relativePath);
  const existing =
    db
      .select()
      .from(workspaceFiles)
      .where(
        and(
          eq(workspaceFiles.connectionId, input.connectionId),
          eq(workspaceFiles.relativePath, normalizedRelativePath),
        ),
      )
      .get() ?? null;

  const workspacePath = input.workspacePath?.trim() || existing?.workspacePath || "";
  if (!workspacePath) {
    throw new Error(
      `Workspace file "${normalizedRelativePath}" is not tracked for connection "${input.connectionId}"`,
    );
  }

  const absolutePath = path.resolve(workspacePath, normalizedRelativePath);
  const relativeToWorkspace = path.relative(workspacePath, absolutePath);
  if (
    !relativeToWorkspace ||
    relativeToWorkspace.startsWith("..") ||
    path.isAbsolute(relativeToWorkspace)
  ) {
    throw new Error(`Resolved workspace file path escapes workspace root: ${normalizedRelativePath}`);
  }

  return {
    connection,
    existing,
    normalizedRelativePath,
    workspacePath,
    absolutePath,
  };
}

function resolveGatewayToken(connection: OpenClawConnection, token?: string): string {
  const resolved = token ?? process.env["OPENCLAW_GATEWAY_TOKEN"];
  if (!resolved) {
    throw new Error(
      connection.hasGatewayToken
        ? `Gateway token is required for OpenClaw connection "${connection.id}"`
        : `No gateway token available for OpenClaw connection "${connection.id}"`,
    );
  }

  return resolved;
}

function normalizeTriggerEndpoint(endpoint: string): string {
  const normalized = endpoint.trim();
  if (!normalized.startsWith("/")) {
    throw new Error("endpoint must be an absolute path beginning with /");
  }

  if (normalized.includes("://") || normalized.includes("..")) {
    throw new Error(`endpoint "${endpoint}" is not allowed`);
  }

  if (!TRIGGER_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    throw new Error(
      `endpoint "${endpoint}" is not a supported OpenClaw action path`,
    );
  }

  return normalized;
}

export async function updateOpenClawCronAction(
  db: DB,
  input: UpdateOpenClawCronActionInput,
): Promise<{ local: Habit; remote: OpenClawCronJob | null }> {
  const fieldNames = Object.keys(input.patch);
  const local = getCronJob(db, input.cronJobId);
  const entityId = local?.id ?? input.cronJobId;

  try {
    const result = await updateConnectionCronJob(
      db,
      input.cronJobId,
      input.patch,
      input.gatewayToken,
    );

    logLowLevelEvent(db, {
      agentId: input.actorAgentId,
      action: "openclaw.action.cron_job.updated",
      entityType: "habit",
      entityId: result.local.id,
      meta: {
        externalId: result.local.externalId,
        fields: fieldNames,
      },
    });

    logActivityEvent(db, {
      actorAgentId: input.actorAgentId,
      source: input.source,
      type: "openclaw.action.cron.updated",
      title: `OpenClaw cron updated: ${result.local.name}`,
      entityType: "cron_job",
      entityId: result.local.id,
      metadata: {
        externalId: result.local.externalId,
        enabled: result.local.enabled,
        fields: fieldNames,
      },
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update OpenClaw cron job";

    logLowLevelEvent(db, {
      agentId: input.actorAgentId,
      action: "openclaw.action.cron_job.update_failed",
      entityType: "habit",
      entityId,
      meta: {
        fields: fieldNames,
        error: message,
      },
    });

    logActivityEvent(db, {
      actorAgentId: input.actorAgentId,
      source: input.source,
      type: "openclaw.action.cron.update_failed",
      title: "OpenClaw cron update failed",
      body: message,
      entityType: "cron_job",
      entityId,
      metadata: {
        fields: fieldNames,
        error: message,
      },
      severity: "error",
    });

    throw error;
  }
}

export function writeTrackedOpenClawFile(
  db: DB,
  input: WriteTrackedOpenClawFileInput,
): WorkspaceFile {
  const target = resolveTrackedFileTarget(db, input);
  const entityId =
    target.existing?.id ?? `${target.connection.id}:${target.normalizedRelativePath}`;

  try {
    fs.mkdirSync(path.dirname(target.absolutePath), { recursive: true });
    fs.writeFileSync(target.absolutePath, input.content, "utf8");

    const sizeBytes = Buffer.byteLength(input.content, "utf8");
    const fileHash = sha256(input.content);
    const now = new Date();

    const file = db.transaction((tx: TransactionDb) => {
      const nextRow = target.existing
        ? tx
            .update(workspaceFiles)
            .set({
              workspacePath: target.workspacePath,
              fileHash,
              sizeBytes,
              lastSeenAt: now,
              updatedAt: now,
            })
            .where(eq(workspaceFiles.id, target.existing.id))
            .returning()
            .get()
        : tx
            .insert(workspaceFiles)
            .values({
              connectionId: target.connection.id,
              workspacePath: target.workspacePath,
              relativePath: target.normalizedRelativePath,
              fileHash,
              sizeBytes,
              lastSeenAt: now,
              createdAt: now,
              updatedAt: now,
            })
            .returning()
            .get();

      if (!nextRow) {
        throw new Error(`Failed to persist tracked workspace file "${target.normalizedRelativePath}"`);
      }

      tx.insert(workspaceFileRevisions)
        .values({
          workspaceFileId: nextRow.id,
          hash: fileHash,
          sizeBytes,
          gitCommitSha: null,
          gitBranch: null,
          source: "action",
          capturedAt: now,
        })
        .run();

      return nextRow;
    });

    logLowLevelEvent(db, {
      agentId: input.actorAgentId,
      action: "openclaw.action.file.written",
      entityType: "workspace_file",
      entityId: file.id,
      meta: {
        connectionId: target.connection.id,
        relativePath: target.normalizedRelativePath,
        workspacePath: target.workspacePath,
        sizeBytes,
        fileHash,
      },
    });

    logActivityEvent(db, {
      actorAgentId: input.actorAgentId,
      source: input.source,
      type: "openclaw.action.file.written",
      title: `Tracked file written: ${target.normalizedRelativePath}`,
      entityType: "workspace_file",
      entityId: file.id,
      metadata: {
        connectionId: target.connection.id,
        relativePath: target.normalizedRelativePath,
        workspacePath: target.workspacePath,
        sizeBytes,
        fileHash,
      },
    });

    return file;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to write tracked workspace file";

    logLowLevelEvent(db, {
      agentId: input.actorAgentId,
      action: "openclaw.action.file.write_failed",
      entityType: "workspace_file",
      entityId,
      meta: {
        connectionId: target.connection.id,
        relativePath: target.normalizedRelativePath,
        error: message,
      },
    });

    logActivityEvent(db, {
      actorAgentId: input.actorAgentId,
      source: input.source,
      type: "openclaw.action.file.write_failed",
      title: "Tracked file write failed",
      body: message,
      entityType: "workspace_file",
      entityId,
      metadata: {
        connectionId: target.connection.id,
        relativePath: target.normalizedRelativePath,
        error: message,
      },
      severity: "error",
    });

    throw error;
  }
}

export async function triggerSupportedOpenClawEndpoint(
  db: DB,
  input: TriggerSupportedOpenClawEndpointInput,
): Promise<TriggerSupportedOpenClawEndpointResult> {
  const connection = getConnectionOrThrow(db, input.connectionId);
  const endpoint = normalizeTriggerEndpoint(input.endpoint);

  if (!connection.gatewayUrl) {
    const error = new Error(`OpenClaw connection "${connection.id}" does not have a gateway URL`);

    logLowLevelEvent(db, {
      agentId: input.actorAgentId,
      action: "openclaw.action.trigger.failed",
      entityType: "openclaw_connection",
      entityId: connection.id,
      meta: {
        endpoint,
        error: error.message,
      },
    });

    logActivityEvent(db, {
      actorAgentId: input.actorAgentId,
      source: input.source,
      type: "openclaw.action.trigger.failed",
      title: "OpenClaw trigger failed",
      body: error.message,
      entityType: "openclaw_connection",
      entityId: connection.id,
      metadata: {
        endpoint,
        error: error.message,
      },
      severity: "error",
    });

    throw error;
  }

  try {
    const url = new URL(endpoint, connection.gatewayUrl).toString();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resolveGatewayToken(connection, input.gatewayToken)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.body ?? {}),
      signal: AbortSignal.timeout(5_000),
    });

    const rawBody = await response.text();
    const parsedBody = rawBody
      ? (() => {
          try {
            return JSON.parse(rawBody) as unknown;
          } catch {
            return rawBody;
          }
        })()
      : null;

    if (!response.ok) {
      throw new Error(
        `OpenClaw trigger ${endpoint} failed with status ${response.status}${rawBody ? `: ${rawBody}` : ""}`,
      );
    }

    logLowLevelEvent(db, {
      agentId: input.actorAgentId,
      action: "openclaw.action.trigger.called",
      entityType: "openclaw_connection",
      entityId: connection.id,
      meta: {
        endpoint,
        status: response.status,
      },
    });

    logActivityEvent(db, {
      actorAgentId: input.actorAgentId,
      source: input.source,
      type: "openclaw.action.trigger.called",
      title: `OpenClaw trigger called: ${endpoint}`,
      entityType: "openclaw_connection",
      entityId: connection.id,
      metadata: {
        endpoint,
        status: response.status,
      },
    });

    return {
      status: response.status,
      response: parsedBody,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to trigger OpenClaw endpoint";

    logLowLevelEvent(db, {
      agentId: input.actorAgentId,
      action: "openclaw.action.trigger.failed",
      entityType: "openclaw_connection",
      entityId: connection.id,
      meta: {
        endpoint,
        error: message,
      },
    });

    logActivityEvent(db, {
      actorAgentId: input.actorAgentId,
      source: input.source,
      type: "openclaw.action.trigger.failed",
      title: "OpenClaw trigger failed",
      body: message,
      entityType: "openclaw_connection",
      entityId: connection.id,
      metadata: {
        endpoint,
        error: message,
      },
      severity: "error",
    });

    throw error;
  }
}
