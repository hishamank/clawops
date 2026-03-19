import {
  eq,
  parseJsonObject,
  workspaceFileRevisions,
  workspaceFiles,
  type DBOrTx,
  type OpenClawConnection,
} from "@clawops/core";
import {
  getCronJob,
  updateConnectionCronJob,
  type UpdateCronJobPatch,
} from "@clawops/habits";
import { getOpenClawConnection } from "../connections.js";

const OPENCLAW_ACTION_TIMEOUT_MS = 10_000;

export class OpenClawActionError extends Error {
  readonly code: string;
  readonly status: number;
  readonly responseStatus: number | null;

  constructor(
    message: string,
    options: {
      code: string;
      status: number;
      responseStatus?: number | null;
      cause?: unknown;
    },
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "OpenClawActionError";
    this.code = options.code;
    this.status = options.status;
    this.responseStatus = options.responseStatus ?? null;
  }
}

export type OpenClawActionResult = Record<string, unknown> | null;

export interface TriggerAgentMessage {
  content: string;
  attachments?: unknown[];
  metadata?: Record<string, unknown>;
}

export interface TriggerAgentResult extends Record<string, unknown> {
  ok?: boolean;
}

export interface WriteTrackedFileResult extends Record<string, unknown> {
  filePath?: string;
  relativePath?: string;
}

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
  workspacePath?: string;
  connectionId: string;
  relativePath: string;
  content: string;
  gatewayToken?: string;
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

function createActionError(
  message: string,
  options: {
    code: string;
    status: number;
    responseStatus?: number | null;
    cause?: unknown;
  },
): OpenClawActionError {
  return new OpenClawActionError(message, options);
}

function summarizeResponseBody(body: unknown): string | null {
  if (typeof body === "string") {
    const trimmed = body.trim();
    return trimmed ? trimmed : null;
  }

  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const message = record["message"] ?? record["error"];
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return null;
}

async function parseActionResponse(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as unknown;
  }

  return await response.text();
}

async function requestGatewayAction(
  gatewayUrl: string,
  token: string,
  pathname: string,
  init: {
    method: "PATCH" | "POST";
    body: Record<string, unknown>;
    actionName: string;
  },
): Promise<{ status: number; body: unknown }> {
  const url = new URL(pathname, gatewayUrl).toString();

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(init.body),
      signal: AbortSignal.timeout(OPENCLAW_ACTION_TIMEOUT_MS),
    });
  } catch (error) {
    throw createActionError(`Failed to ${init.actionName}: network request failed`, {
      code: "OPENCLAW_ACTION_REQUEST_FAILED",
      status: 502,
      cause: error,
    });
  }

  const responseBody = await parseActionResponse(response);
  if (!response.ok) {
    const summary = summarizeResponseBody(responseBody);
    throw createActionError(
      summary
        ? `Failed to ${init.actionName}: ${summary}`
        : `Failed to ${init.actionName}: gateway returned ${response.status}`,
      {
        code: "OPENCLAW_ACTION_REQUEST_FAILED",
        status: 502,
        responseStatus: response.status,
      },
    );
  }

  return { status: response.status, body: responseBody };
}

function requireConnection(db: DBOrTx, connectionId: string): OpenClawConnection {
  const connection = getOpenClawConnection(db, connectionId);
  if (!connection) {
    throw createActionError(`OpenClaw connection "${connectionId}" not found`, {
      code: "OPENCLAW_CONNECTION_NOT_FOUND",
      status: 404,
    });
  }

  return connection;
}

function resolveGatewayUrl(connection: OpenClawConnection): string {
  if (!connection.gatewayUrl) {
    throw createActionError(
      `OpenClaw connection "${connection.id}" is missing a gateway URL`,
      {
        code: "OPENCLAW_GATEWAY_URL_MISSING",
        status: 500,
      },
    );
  }

  return connection.gatewayUrl;
}

function resolveGatewayToken(
  connection: OpenClawConnection,
  token?: string,
): string {
  if (token && token.trim()) {
    return token.trim();
  }

  const meta = parseJsonObject(connection.meta);
  const storedToken = meta["gatewayToken"];
  if (typeof storedToken === "string" && storedToken.trim()) {
    return storedToken.trim();
  }

  const envToken = process.env["OPENCLAW_GATEWAY_TOKEN"];
  if (envToken && envToken.trim()) {
    return envToken.trim();
  }

  throw createActionError(
    `OpenClaw connection "${connection.id}" is missing a gateway token`,
    {
      code: "OPENCLAW_GATEWAY_TOKEN_MISSING",
      status: 500,
    },
  );
}

function normalizeMessage(
  message: string | TriggerAgentMessage,
): Record<string, unknown> {
  if (typeof message === "string") {
    return { message };
  }

  return {
    message: message.content,
    attachments: message.attachments,
    metadata: message.metadata,
  };
}

export async function updateCronJob(
  gatewayUrl: string,
  token: string,
  cronId: string,
  patch: UpdateCronJobPatch,
): Promise<OpenClawActionResult> {
  const { body } = await requestGatewayAction(
    gatewayUrl,
    token,
    `/api/cron/${encodeURIComponent(cronId)}`,
    {
      method: "PATCH",
      body: patch as Record<string, unknown>,
      actionName: `update OpenClaw cron job "${cronId}"`,
    },
  );

  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

export async function triggerAgent(
  gatewayUrl: string,
  token: string,
  agentId: string,
  message: string | TriggerAgentMessage,
): Promise<TriggerAgentResult | null> {
  const { body } = await requestGatewayAction(
    gatewayUrl,
    token,
    `/api/sessions/${encodeURIComponent(agentId)}/send`,
    {
      method: "POST",
      body: normalizeMessage(message),
      actionName: `trigger OpenClaw agent "${agentId}"`,
    },
  );

  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as TriggerAgentResult)
    : null;
}

export async function writeTrackedFile(
  gatewayUrl: string,
  token: string,
  filePath: string,
  content: string,
  options?: {
    workspacePath?: string;
    relativePath?: string;
  },
): Promise<WriteTrackedFileResult | null> {
  const { body } = await requestGatewayAction(
    gatewayUrl,
    token,
    "/api/workspace/files",
    {
      method: "POST",
      body: {
        filePath,
        content,
        ...(options?.workspacePath ? { workspacePath: options.workspacePath } : {}),
        ...(options?.relativePath ? { relativePath: options.relativePath } : {}),
      },
      actionName: `write tracked OpenClaw file "${filePath}"`,
    },
  );

  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as WriteTrackedFileResult)
    : null;
}

export async function updateOpenClawCronAction(
  db: DBOrTx,
  input: UpdateOpenClawCronActionInput,
): Promise<Awaited<ReturnType<typeof updateConnectionCronJob>>> {
  const job = getCronJob(db, input.cronJobId);
  if (!job) {
    throw createActionError(`Cron job "${input.cronJobId}" not found`, {
      code: "OPENCLAW_CRON_JOB_NOT_FOUND",
      status: 404,
    });
  }

  try {
    return await updateConnectionCronJob(
      db,
      input.cronJobId,
      input.patch,
      input.gatewayToken,
    );
  } catch (error) {
    if (error instanceof OpenClawActionError) {
      throw error;
    }

    throw createActionError(
      error instanceof Error ? error.message : "Failed to update OpenClaw cron job",
      {
        code: "OPENCLAW_ACTION_REQUEST_FAILED",
        status: 502,
        cause: error,
      },
    );
  }
}

export async function writeTrackedOpenClawFile(
  db: DBOrTx,
  input: WriteTrackedOpenClawFileInput,
): Promise<WriteTrackedFileResult | null> {
  const connection = requireConnection(db, input.connectionId);
  return writeTrackedFile(
    resolveGatewayUrl(connection),
    resolveGatewayToken(connection, input.gatewayToken),
    input.relativePath,
    input.content,
    {
      workspacePath: input.workspacePath,
      relativePath: input.relativePath,
    },
  );
}

export interface RevertTrackedOpenClawFileInput extends OpenClawActionAuditInput {
  revisionId: string;
  gatewayToken?: string;
}

export interface RevertTrackedOpenClawFileResult {
  revision: { id: string; workspaceFileId: string; capturedAt: Date | null };
  file: { id: string; connectionId: string; relativePath: string };
  gatewayResult: WriteTrackedFileResult | null;
}

export async function revertTrackedOpenClawFile(
  db: DBOrTx,
  input: RevertTrackedOpenClawFileInput,
): Promise<RevertTrackedOpenClawFileResult> {
  const revision = db
    .select()
    .from(workspaceFileRevisions)
    .where(eq(workspaceFileRevisions.id, input.revisionId))
    .get();

  if (!revision) {
    throw createActionError(
      `Workspace file revision "${input.revisionId}" not found`,
      { code: "REVISION_NOT_FOUND", status: 404 },
    );
  }

  if (revision.content === null || revision.content === undefined) {
    throw createActionError(
      `Workspace file revision "${input.revisionId}" has no stored content`,
      { code: "REVISION_CONTENT_MISSING", status: 422 },
    );
  }

  const file = db
    .select()
    .from(workspaceFiles)
    .where(eq(workspaceFiles.id, revision.workspaceFileId))
    .get();

  if (!file) {
    throw createActionError(
      `Workspace file "${revision.workspaceFileId}" not found`,
      { code: "WORKSPACE_FILE_NOT_FOUND", status: 404 },
    );
  }

  const connection = requireConnection(db, file.connectionId);
  const gatewayResult = await writeTrackedFile(
    resolveGatewayUrl(connection),
    resolveGatewayToken(connection, input.gatewayToken),
    file.relativePath,
    revision.content,
    {
      workspacePath: file.workspacePath,
      relativePath: file.relativePath,
    },
  );

  return {
    revision: {
      id: revision.id,
      workspaceFileId: revision.workspaceFileId,
      capturedAt: revision.capturedAt,
    },
    file: {
      id: file.id,
      connectionId: file.connectionId,
      relativePath: file.relativePath,
    },
    gatewayResult,
  };
}

export async function triggerSupportedOpenClawEndpoint(
  db: DBOrTx,
  input: TriggerSupportedOpenClawEndpointInput,
): Promise<TriggerSupportedOpenClawEndpointResult> {
  const connection = requireConnection(db, input.connectionId);
  const gatewayUrl = resolveGatewayUrl(connection);
  const token = resolveGatewayToken(connection, input.gatewayToken);
  if (input.endpoint.startsWith("//")) {
    throw createActionError(
      `Invalid endpoint "${input.endpoint}": protocol-relative URLs are not allowed`,
      { code: "OPENCLAW_INVALID_ENDPOINT", status: 400 },
    );
  }
  const pathname = input.endpoint.startsWith("/")
    ? input.endpoint
    : `/${input.endpoint}`;
  const result = await requestGatewayAction(gatewayUrl, token, pathname, {
    method: "POST",
    body: input.body ?? {},
    actionName: `trigger OpenClaw endpoint "${pathname}"`,
  });

  return {
    status: result.status,
    response: result.body,
  };
}
