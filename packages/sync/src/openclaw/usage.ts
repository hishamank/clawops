import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  and,
  eq,
  openclawAgents,
  openclawSessionUsageCursors,
  openclawSessionUsageEntries,
  openclawSessions,
  sql,
  toJsonObject,
  type DBOrTx,
  type OpenClawConnection,
  type OpenClawSessionUsageCursor,
  type OpenClawSessionUsageEntry,
} from "@clawops/core";
import { loadOpenClawConfig } from "./scanner.js";
import type { OpenClawConfig } from "./types.js";

const DEFAULT_IGNORE_PROVIDERS = new Set(["openclaw"]);
const DEFAULT_IGNORE_MODELS = new Set(["delivery-mirror"]);

interface JsonRecord {
  [key: string]: unknown;
}

interface AgentMapping {
  id: string;
  linkedAgentId: string;
  externalAgentId: string;
  externalAgentName: string;
}

interface SessionMapping {
  id: string;
  sessionKey: string;
}

interface ParsedUsageLine {
  rawEntry: JsonRecord;
  eventTimestamp: Date;
  provider: string;
  model: string;
  modelAlias?: string;
  tokensIn: number;
  tokensOut: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: number;
  messageType: string | null;
  rawUsage: JsonRecord | null;
  rawMessage: JsonRecord | null;
  fingerprint: string;
}

export interface SessionUsageFileSyncResult {
  sessionFilePath: string;
  externalAgentId: string | null;
  importedCount: number;
  scannedLineCount: number;
  skippedLineCount: number;
  rescanned: boolean;
}

export interface SessionUsageSyncResult {
  scannedFileCount: number;
  rescannedFileCount: number;
  importedCount: number;
  skippedLineCount: number;
  processedFiles: SessionUsageFileSyncResult[];
}

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseOpenClawTimestamp(timestamp: unknown): Date | null {
  if (typeof timestamp !== "string" || !timestamp.trim()) {
    return null;
  }

  const normalized = timestamp.endsWith("Z") ? timestamp : `${timestamp}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildFingerprint(sessionFilePath: string, line: string): string {
  return crypto
    .createHash("sha256")
    .update(`${sessionFilePath}\n${line.trim()}`)
    .digest("hex");
}

function collectModelAliases(config: OpenClawConfig): Map<string, string> {
  const aliases = new Map<string, string>();

  const pushAliases = (value: unknown): void => {
    const modelMap = asRecord(value);
    for (const [modelId, configValue] of Object.entries(modelMap)) {
      const alias = pickString(asRecord(configValue)["alias"]);
      if (alias) {
        aliases.set(modelId, alias);
      }
    }
  };

  pushAliases(config.agent?.models);
  pushAliases(config.agents?.defaults?.models);

  const listedAgents = Array.isArray(config.agents?.list) ? config.agents.list : [];
  for (const listedAgent of listedAgents) {
    pushAliases(listedAgent?.models);
  }

  const agentConfigEntries = Object.entries(config.agents ?? {});
  for (const [, value] of agentConfigEntries) {
    if (Array.isArray(value)) {
      continue;
    }
    pushAliases(value?.models);
  }

  return aliases;
}

function listSessionFiles(connection: OpenClawConnection): Array<{ absolutePath: string; sessionFilePath: string; externalAgentId: string | null }> {
  const agentsDir = path.join(connection.rootPath, "agents");

  try {
    const agentEntries = fs.readdirSync(agentsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((left, right) => left.name.localeCompare(right.name));

    return agentEntries.flatMap((entry) => {
      const sessionsDir = path.join(agentsDir, entry.name, "sessions");

      try {
        return fs
          .readdirSync(sessionsDir, { withFileTypes: true })
          .filter((file) => file.isFile() && file.name.endsWith(".jsonl"))
          .sort((left, right) => left.name.localeCompare(right.name))
          .map((file) => {
            const absolutePath = path.join(sessionsDir, file.name);
            return {
              absolutePath,
              sessionFilePath: path.relative(connection.rootPath, absolutePath),
              externalAgentId: entry.name,
            };
          });
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

function getSessionKey(filePath: string, entry: JsonRecord): string {
  return pickString(
    entry["sessionKey"],
    entry["session_key"],
    asRecord(entry["message"])["sessionKey"],
    asRecord(entry["message"])["session_key"],
    path.basename(filePath, ".jsonl"),
  ) ?? path.basename(filePath, ".jsonl");
}

function parseUsageLine(
  line: string,
  sessionFilePath: string,
  modelAliases: Map<string, string>,
): ParsedUsageLine | null {
  let entry: JsonRecord;

  try {
    entry = JSON.parse(line) as JsonRecord;
  } catch {
    return null;
  }

  if (entry["type"] !== "message") {
    return null;
  }

  const eventTimestamp = parseOpenClawTimestamp(entry["timestamp"]);
  if (!eventTimestamp) {
    return null;
  }

  const message = asRecord(entry["message"]);
  const usage = asRecord(message["usage"]);
  const provider = pickString(message["provider"], message["vendor"], "unknown") ?? "unknown";
  const model = pickString(message["model"], message["modelId"], "unknown") ?? "unknown";

  if (DEFAULT_IGNORE_PROVIDERS.has(provider) || DEFAULT_IGNORE_MODELS.has(model)) {
    return null;
  }

  const tokensIn = toNumber(usage["input"]);
  const tokensOut = toNumber(usage["output"]);
  const cacheRead = toNumber(usage["cacheRead"]);
  const cacheWrite = toNumber(usage["cacheWrite"]);
  const totalTokens = toNumber(usage["totalTokens"]) || tokensIn + tokensOut + cacheRead + cacheWrite;
  const cost = toNumber(asRecord(usage["cost"])["total"]);

  if (totalTokens === 0 && cost === 0) {
    return null;
  }

  return {
    rawEntry: entry,
    eventTimestamp,
    provider,
    model,
    modelAlias: modelAliases.get(model),
    tokensIn,
    tokensOut,
    cacheRead,
    cacheWrite,
    totalTokens,
    cost,
    messageType: pickString(message["type"], message["role"], message["kind"]) ?? null,
    rawUsage: Object.keys(usage).length > 0 ? usage : null,
    rawMessage: Object.keys(message).length > 0 ? message : null,
    fingerprint: buildFingerprint(sessionFilePath, line),
  };
}

function parseBufferLines(
  buffer: Buffer,
  startOffset: number,
): Array<{ line: string; offsetAfterLine: number }> {
  const sliced = buffer.subarray(startOffset);
  const lines: Array<{ line: string; offsetAfterLine: number }> = [];
  let lineStart = 0;

  for (let index = 0; index < sliced.length; index += 1) {
    if (sliced[index] !== 10) {
      continue;
    }

    lines.push({
      line: sliced.subarray(lineStart, index).toString("utf8"),
      offsetAfterLine: startOffset + index + 1,
    });
    lineStart = index + 1;
  }

  if (lineStart < sliced.length) {
    lines.push({
      line: sliced.subarray(lineStart).toString("utf8"),
      offsetAfterLine: startOffset + sliced.length,
    });
  }

  return lines;
}

function upsertCursor(
  db: DBOrTx,
  connectionId: string,
  sessionFilePath: string,
  externalAgentId: string | null,
  fileSizeBytes: number,
  fileMtimeMs: number,
  lastByteOffset: number,
  lastLineNumber: number,
): void {
  const now = new Date();

  db.insert(openclawSessionUsageCursors)
    .values({
      connectionId,
      externalAgentId,
      sessionFilePath,
      fileSizeBytes,
      fileMtimeMs,
      lastByteOffset,
      lastLineNumber,
      lastSyncedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        openclawSessionUsageCursors.connectionId,
        openclawSessionUsageCursors.sessionFilePath,
      ],
      set: {
        externalAgentId,
        fileSizeBytes,
        fileMtimeMs,
        lastByteOffset,
        lastLineNumber,
        lastSyncedAt: now,
        updatedAt: now,
      },
    })
    .run();
}

function getAgentMappings(
  db: DBOrTx,
  connectionId: string,
): Map<string, AgentMapping> {
  const mappings = db
    .select({
      id: openclawAgents.id,
      linkedAgentId: openclawAgents.linkedAgentId,
      externalAgentId: openclawAgents.externalAgentId,
      externalAgentName: openclawAgents.externalAgentName,
    })
    .from(openclawAgents)
    .where(eq(openclawAgents.connectionId, connectionId))
    .all();

  return new Map(mappings.map((mapping) => [mapping.externalAgentId, mapping]));
}

function getSessionMappings(
  db: DBOrTx,
  connectionId: string,
): Map<string, SessionMapping> {
  const sessions = db
    .select({
      id: openclawSessions.id,
      sessionKey: openclawSessions.sessionKey,
    })
    .from(openclawSessions)
    .where(eq(openclawSessions.connectionId, connectionId))
    .all();

  return new Map(sessions.map((session) => [session.sessionKey, session]));
}

function getExistingCursors(
  db: DBOrTx,
  connectionId: string,
): Map<string, OpenClawSessionUsageCursor> {
  const cursors = db
    .select()
    .from(openclawSessionUsageCursors)
    .where(eq(openclawSessionUsageCursors.connectionId, connectionId))
    .all();

  return new Map(cursors.map((cursor) => [cursor.sessionFilePath, cursor]));
}

function insertUsageEntry(
  db: DBOrTx,
  value: Omit<OpenClawSessionUsageEntry, "id" | "createdAt">,
): boolean {
  const inserted = db
    .insert(openclawSessionUsageEntries)
    .values(value)
    .onConflictDoNothing({
      target: [
        openclawSessionUsageEntries.connectionId,
        openclawSessionUsageEntries.eventFingerprint,
      ],
    })
    .returning({ id: openclawSessionUsageEntries.id })
    .get();

  return inserted !== undefined;
}

function runInTransaction<T>(
  db: DBOrTx,
  callback: (tx: DBOrTx) => T,
): T {
  const transactionalDb = db as DBOrTx & {
    transaction?: <TResult>(fn: (tx: DBOrTx) => TResult) => TResult;
  };

  if (typeof transactionalDb.transaction === "function") {
    return transactionalDb.transaction((tx) => callback(tx));
  }

  return callback(db);
}

export function syncSessionUsage(
  db: DBOrTx,
  connection: OpenClawConnection,
): SessionUsageSyncResult {
  const modelAliases = collectModelAliases(loadOpenClawConfig(connection.rootPath));
  const agentMappings = getAgentMappings(db, connection.id);
  const sessionMappings = getSessionMappings(db, connection.id);
  const cursors = getExistingCursors(db, connection.id);
  const processedFiles: SessionUsageFileSyncResult[] = [];

  let importedCount = 0;
  let skippedLineCount = 0;
  let rescannedFileCount = 0;

  for (const file of listSessionFiles(connection)) {
    const stat = fs.statSync(file.absolutePath);
    const cursor = cursors.get(file.sessionFilePath);
    const rescanned = cursor !== undefined && stat.size < cursor.lastByteOffset;
    const startOffset = rescanned ? 0 : Math.min(cursor?.lastByteOffset ?? 0, stat.size);
    const startLineNumber = rescanned ? 0 : cursor?.lastLineNumber ?? 0;
    const buffer = fs.readFileSync(file.absolutePath);
    const parsedLines = parseBufferLines(buffer, startOffset);
    const agentMapping = file.externalAgentId
      ? agentMappings.get(file.externalAgentId)
      : undefined;

    const fileResult = runInTransaction(db, (tx) => {
      let importedForFile = 0;
      let skippedForFile = 0;
      let lineNumber = startLineNumber;

      for (const parsedLine of parsedLines) {
        lineNumber += 1;

        if (!parsedLine.line.trim()) {
          continue;
        }

        const usageLine = parseUsageLine(parsedLine.line, file.sessionFilePath, modelAliases);
        if (!usageLine) {
          skippedForFile += 1;
          continue;
        }

        const sessionKey = getSessionKey(file.absolutePath, usageLine.rawEntry);
        const sessionMapping = sessionMappings.get(sessionKey);

        const inserted = insertUsageEntry(tx, {
          connectionId: connection.id,
          openclawAgentId: agentMapping?.id ?? null,
          linkedAgentId: agentMapping?.linkedAgentId ?? null,
          sessionId: sessionMapping?.id ?? null,
          externalAgentId: file.externalAgentId,
          externalAgentName: agentMapping?.externalAgentName ?? file.externalAgentId,
          sessionKey,
          sessionFilePath: file.sessionFilePath,
          eventFingerprint: usageLine.fingerprint,
          eventTimestamp: usageLine.eventTimestamp,
          provider: usageLine.provider,
          model: usageLine.model,
          modelAlias: usageLine.modelAlias ?? null,
          tokensIn: usageLine.tokensIn,
          tokensOut: usageLine.tokensOut,
          cacheRead: usageLine.cacheRead,
          cacheWrite: usageLine.cacheWrite,
          totalTokens: usageLine.totalTokens,
          cost: usageLine.cost,
          messageType: usageLine.messageType,
          rawUsage: usageLine.rawUsage ? toJsonObject(usageLine.rawUsage) : null,
          rawMessage: usageLine.rawMessage ? toJsonObject(usageLine.rawMessage) : null,
        });

        if (inserted) {
          importedForFile += 1;
        }
      }

      upsertCursor(
        tx,
        connection.id,
        file.sessionFilePath,
        file.externalAgentId,
        stat.size,
        stat.mtimeMs,
        stat.size,
        lineNumber,
      );

      return {
        importedForFile,
        skippedForFile,
        lineNumber,
      };
    });

    importedCount += fileResult.importedForFile;
    skippedLineCount += fileResult.skippedForFile;
    if (rescanned) {
      rescannedFileCount += 1;
    }

    processedFiles.push({
      sessionFilePath: file.sessionFilePath,
      externalAgentId: file.externalAgentId,
      importedCount: fileResult.importedForFile,
      scannedLineCount: parsedLines.length,
      skippedLineCount: fileResult.skippedForFile,
      rescanned,
    });
  }

  return {
    scannedFileCount: processedFiles.length,
    rescannedFileCount,
    importedCount,
    skippedLineCount,
    processedFiles,
  };
}

export interface ImportedUsageSummary {
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
  count: number;
}

export function getImportedUsageSummary(
  db: DBOrTx,
  connectionId: string,
): ImportedUsageSummary {
  const result = db
    .select({
      totalTokensIn: sql<number>`coalesce(sum(${openclawSessionUsageEntries.tokensIn}), 0)`,
      totalTokensOut: sql<number>`coalesce(sum(${openclawSessionUsageEntries.tokensOut}), 0)`,
      totalCost: sql<number>`coalesce(sum(${openclawSessionUsageEntries.cost}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(openclawSessionUsageEntries)
    .where(eq(openclawSessionUsageEntries.connectionId, connectionId))
    .get();

  return {
    totalTokensIn: Number(result?.totalTokensIn ?? 0),
    totalTokensOut: Number(result?.totalTokensOut ?? 0),
    totalCost: Number(result?.totalCost ?? 0),
    count: Number(result?.count ?? 0),
  };
}

export function listImportedUsageEntries(
  db: DBOrTx,
  connectionId: string,
): OpenClawSessionUsageEntry[] {
  return db
    .select()
    .from(openclawSessionUsageEntries)
    .where(eq(openclawSessionUsageEntries.connectionId, connectionId))
    .all();
}

export function getUsageCursor(
  db: DBOrTx,
  connectionId: string,
  sessionFilePath: string,
): OpenClawSessionUsageCursor | null {
  return db
    .select()
    .from(openclawSessionUsageCursors)
    .where(and(
      eq(openclawSessionUsageCursors.connectionId, connectionId),
      eq(openclawSessionUsageCursors.sessionFilePath, sessionFilePath),
    ))
    .get() ?? null;
}
