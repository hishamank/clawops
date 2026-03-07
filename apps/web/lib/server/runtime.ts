import "server-only";

import type { DB } from "@clawops/core";
import { getAgentByApiKey } from "@clawops/agents";
import { hashApiKey } from "@clawops/domain";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { createRequire } from "node:module";

let migrated = false;
let cachedDb: DB | null = null;
const require = createRequire(import.meta.url);

export function getDb(): DB {
  if (!cachedDb) {
    const coreDb = require("@clawops/core/db") as { db: DB };
    cachedDb = coreDb.db;
  }
  if (!migrated) {
    const migrate = require("@clawops/core/migrate") as { runMigrations: () => void };
    migrate.runMigrations();
    migrated = true;
  }
  return cachedDb;
}

export function jsonError(status: number, error: string, code: string): NextResponse {
  return NextResponse.json({ error, code }, { status });
}

export function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  return req.json().then((body) => schema.parse(body));
}

export function parseSearch<T>(req: Request, schema: z.ZodType<T>): T {
  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries());
  return schema.parse(params);
}

export function getAgentIdFromApiKey(req: Request): string | null {
  const key = req.headers.get("x-api-key");
  if (!key) return null;
  const agent = getAgentByApiKey(getDb(), hashApiKey(key));
  return agent?.id ?? null;
}

export function requireAgentId(req: Request): string | NextResponse {
  const key = req.headers.get("x-api-key");
  if (!key) {
    return jsonError(401, "Missing API key", "UNAUTHORIZED");
  }
  const agent = getAgentByApiKey(getDb(), hashApiKey(key));
  if (!agent) {
    return jsonError(401, "Invalid API key", "UNAUTHORIZED");
  }
  return agent.id;
}

export function isNotFoundError(err: unknown): boolean {
  return err instanceof Error && /not found/i.test(err.message);
}
