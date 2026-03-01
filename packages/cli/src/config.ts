import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface ClawOpsConfig {
  apiUrl?: string;
}

const CONFIG_DIR = join(homedir(), ".clawops");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export function loadConfig(): ClawOpsConfig {
  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw) as ClawOpsConfig;
  } catch {
    return {};
  }
}

export function saveConfig(config: ClawOpsConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
}

export function getApiUrl(): string {
  const envUrl = process.env.CLAWOPS_API_URL;
  if (envUrl) return envUrl;
  const config = loadConfig();
  return config.apiUrl ?? "http://localhost:3001";
}
