import crypto from "node:crypto";
import { getModelPricing } from "./modelPricing.js";

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
const ID_LENGTH = 21;

export function generateId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
  let id = "";
  for (let i = 0; i < ID_LENGTH; i++) {
    id += ALPHABET[bytes[i] & 63];
  }
  return id;
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function verifyApiKey(key: string, hash: string): boolean {
  const computed = hashApiKey(key);
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
}

export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

export function calcCost(
  model: string,
  tokensIn: number,
  tokensOut: number,
): number {
  const pricing = getModelPricing(model);
  return (
    (tokensIn / 1_000_000) * pricing.inputPer1M +
    (tokensOut / 1_000_000) * pricing.outputPer1M
  );
}
