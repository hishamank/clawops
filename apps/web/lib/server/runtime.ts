import "server-only";

import type { DB } from "@clawops/core";
import { getAgentByApiKey } from "@clawops/agents";
import { hashApiKey } from "@clawops/domain";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

let migrated = false;
let cachedDb: DB | null = null;

// Load .env from project root (../../.env from apps/web)
function loadEnvFile(): void {
  // When running in Next.js, cwd() is the app root (apps/web in dev, .next/standalone/apps/web in prod)
  // Try both ../../.env (monorepo root) and .env (app root)
  const possiblePaths = [
    resolve(process.cwd(), "../../.env"),
    resolve(process.cwd(), ".env"),
  ];

  for (const envPath of possiblePaths) {
    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, "utf-8");
      for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          const value = valueParts.join("=").trim();
          // Only set if not already defined
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
      break; // Stop after loading first valid .env
    }
  }
}

// Use dynamic require to avoid bundling issues
const require = createRequire(import.meta.url);

export function getDb(): DB {
  if (!cachedDb) {
    // Load .env before requiring db module
    loadEnvFile();
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
