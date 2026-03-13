export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import {
  ingestOpenClawInboundEvent,
  OpenClawInboundEventProcessingError,
  OpenClawInboundEventValidationError,
} from "@clawops/sync";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getDb,
  jsonError,
} from "@/lib/server/runtime";

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(/\s+/, 2);
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token;
}

const inboundEnvelopeSchema = z.object({}).passthrough();

function authenticateInboundEvent(req: Request, rawBody: Buffer): NextResponse | null {
  const secret = process.env["OPENCLAW_EVENTS_SECRET"]?.trim();
  if (!secret) {
    return jsonError(
      503,
      "OPENCLAW_EVENTS_SECRET is not configured",
      "OPENCLAW_EVENTS_AUTH_NOT_CONFIGURED",
    );
  }

  const token =
    req.headers.get("x-openclaw-event-token")?.trim() ??
    parseBearerToken(req);
  if (token && safeCompare(token, secret)) {
    return null;
  }

  const signature = req.headers.get("x-openclaw-signature")?.trim();
  if (signature) {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    const normalizedSignature = signature.startsWith("sha256=")
      ? signature.slice("sha256=".length)
      : signature;

    if (safeCompare(normalizedSignature, expected)) {
      return null;
    }
  }

  return jsonError(401, "Invalid OpenClaw event credentials", "UNAUTHORIZED");
}

export async function POST(req: Request): Promise<NextResponse> {
  const rawBuffer = Buffer.from(await req.arrayBuffer());
  const authError = authenticateInboundEvent(req, rawBuffer);
  if (authError) {
    return authError;
  }

  let body: unknown;

  try {
    body = rawBuffer.length > 0 ? (JSON.parse(rawBuffer.toString("utf8")) as unknown) : {};
    body = inboundEnvelopeSchema.parse(body);
  } catch {
    return jsonError(400, "Request body must be valid JSON", "VALIDATION_ERROR");
  }

  try {
    const result = ingestOpenClawInboundEvent(getDb(), body);

    return NextResponse.json(
      {
        ok: true,
        connectionId: result.connection.id,
        normalizedType: result.normalizedEvent.type,
        lowLevelEventId: result.lowLevelEvent.id,
        activityEventId: result.activityEvent.id,
        stateChanges: result.stateChanges,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof OpenClawInboundEventValidationError) {
      return jsonError(400, error.message, error.code);
    }

    if (error instanceof OpenClawInboundEventProcessingError) {
      const status =
        error.code === "OPENCLAW_CONNECTION_NOT_FOUND" ? 404 : 422;
      return jsonError(status, error.message, error.code);
    }

    return jsonError(
      500,
      error instanceof Error ? error.message : "Failed to ingest OpenClaw event",
      "INTERNAL_ERROR",
    );
  }
}
