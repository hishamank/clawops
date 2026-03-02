import crypto from "node:crypto";
import { getModelPricing } from "./modelPricing.js";

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
const ID_LENGTH = 21;

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 32;
const SALT_LEN = 16;

export function generateId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
  let id = "";
  for (let i = 0; i < ID_LENGTH; i++) {
    id += ALPHABET[bytes[i] & 63];
  }
  return id;
}

export function hashApiKey(key: string): string {
  const salt = crypto.randomBytes(SALT_LEN);
  const hash = crypto.scryptSync(key, salt, KEY_LEN, SCRYPT_PARAMS);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyApiKey(key: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const computed = crypto.scryptSync(key, salt, KEY_LEN, SCRYPT_PARAMS);
  return crypto.timingSafeEqual(computed, expected);
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
