import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import vm from "node:vm";
import type { SyncAgent, SyncWorkspace } from "../types.js";
import type { OpenClawConfig, OpenClawScanOptions } from "./types.js";

function resolvePath(p: string): string {
  return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p;
}

function resolveConfigPath(baseDir: string, p: string): string {
  const resolvedHome = resolvePath(p);
  if (path.isAbsolute(resolvedHome)) return resolvedHome;
  return path.resolve(baseDir, resolvedHome);
}

function readFileOptional(filePath: string): string | undefined {
  try { return fs.readFileSync(filePath, "utf8"); } catch { return undefined; }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
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

function pickStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean);
    return items.length > 0 ? items : undefined;
  }
  if (typeof value === "string" && value.trim()) {
    const items = value.split(",").map((v) => v.trim()).filter(Boolean);
    return items.length > 0 ? items : undefined;
  }
  return undefined;
}

function parseJsonLike(text: string, sourcePath: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    try {
      const script = new vm.Script(`(${text})`, { filename: sourcePath });
      return script.runInNewContext({}, { timeout: 200 });
    } catch {
      return {};
    }
  }
}

function deepMerge(base: unknown, override: unknown): unknown {
  if (!base || typeof base !== "object" || Array.isArray(base)) {
    return override;
  }
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    return override;
  }

  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  const over = override as Record<string, unknown>;
  for (const [key, value] of Object.entries(over)) {
    const current = result[key];
    if (
      current &&
      value &&
      typeof current === "object" &&
      typeof value === "object" &&
      !Array.isArray(current) &&
      !Array.isArray(value)
    ) {
      result[key] = deepMerge(current, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function resolveIncludes(
  value: unknown,
  currentDir: string,
  depth = 0,
): unknown {
  if (depth > 10) return value;
  if (Array.isArray(value)) {
    return value.map((item) => resolveIncludes(item, currentDir, depth + 1));
  }
  if (!value || typeof value !== "object") return value;

  const obj = { ...(value as Record<string, unknown>) };
  const includeValue = obj["$include"];
  delete obj["$include"];

  let base: unknown = obj;
  if (typeof includeValue === "string") {
    const includePath = path.resolve(currentDir, includeValue);
    const includeText = readFileOptional(includePath);
    if (includeText) {
      const parsed = parseJsonLike(includeText, includePath);
      base = resolveIncludes(parsed, path.dirname(includePath), depth + 1);
    }
  } else if (Array.isArray(includeValue)) {
    let merged: unknown = {};
    for (const entry of includeValue) {
      if (typeof entry !== "string") continue;
      const includePath = path.resolve(currentDir, entry);
      const includeText = readFileOptional(includePath);
      if (!includeText) continue;
      const parsed = parseJsonLike(includeText, includePath);
      const resolved = resolveIncludes(parsed, path.dirname(includePath), depth + 1);
      merged = deepMerge(merged, resolved);
    }
    base = merged;
  }

  const resolvedLocal = Object.fromEntries(
    Object.entries(obj).map(([key, entry]) => [key, resolveIncludes(entry, currentDir, depth + 1)]),
  );
  return deepMerge(base, resolvedLocal);
}

function pickModel(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  const modelRecord = asRecord(value);
  return pickString(modelRecord["primary"], modelRecord["model"], modelRecord["default"]);
}

export function scanOpenClaw(options: OpenClawScanOptions = {}): {
  agents: SyncAgent[];
  workspaces: SyncWorkspace[];
  gatewayUrl: string;
} {
  const openclawDir = resolvePath(options.openclawDir ?? process.env["OPENCLAW_DIR"] ?? "~/.openclaw");
  const configPath = path.join(openclawDir, "openclaw.json");

  let config: OpenClawConfig = {};
  const configRaw = readFileOptional(configPath);
  if (configRaw) {
    const parsed = parseJsonLike(configRaw, configPath);
    const resolved = resolveIncludes(parsed, path.dirname(configPath));
    config = asRecord(resolved) as OpenClawConfig;
  }

  const gatewayPort = config.gateway?.port ?? 3000;
  const gatewayHost = config.gateway?.host ?? "localhost";
  const gatewayUrl = options.gatewayUrl ?? `http://${gatewayHost}:${gatewayPort}`;

  // Collect agents from config
  const agents: SyncAgent[] = [];
  const workspaces: SyncWorkspace[] = [];

  // Default workspace
  const defaultWorkspace = resolvePath(
    resolveConfigPath(
      openclawDir,
      config.agent?.workspace ?? config.agents?.defaults?.workspace ?? "~/.openclaw/workspace",
    )
  );

  // Build workspace candidates from config + filesystem
  const workspaceMap = new Map<string, { workspacePath: string; config?: Record<string, unknown> }>();
  const agentListRaw = asRecord(config.agents)["list"];
  const agentList = Array.isArray(agentListRaw) ? agentListRaw : [];
  const globalAgentConfig = asRecord(config.agent);
  const defaultAgentConfig = asRecord(config.agents?.defaults);

  for (const entry of agentList) {
    const agentConfig = asRecord(entry);
    const agentId = pickString(agentConfig["id"], agentConfig["name"]);
    if (!agentId) continue;
    const workspacePath = resolvePath(
      resolveConfigPath(
        openclawDir,
        pickString(agentConfig["workspace"], defaultAgentConfig["workspace"], defaultWorkspace) ?? defaultWorkspace,
      ),
    );
    workspaceMap.set(agentId, { workspacePath, config: agentConfig });
  }

  try {
    const entries = fs.readdirSync(openclawDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "workspace" || entry.name.startsWith("workspace-")) {
        const profileId = entry.name === "workspace" ? "main" : entry.name.replace("workspace-", "");
        if (!workspaceMap.has(profileId)) {
          workspaceMap.set(profileId, { workspacePath: path.join(openclawDir, entry.name) });
        }
      }
    }
  } catch {
    // openclawDir doesn't exist yet
  }

  // Also check agents directory for registered agents
  const agentsDir = path.join(openclawDir, "agents");
  try {
    const agentEntries = fs.readdirSync(agentsDir, { withFileTypes: true });
    for (const entry of agentEntries) {
      if (!entry.isDirectory()) continue;
      const agentId = entry.name;
      if (!workspaceMap.has(agentId)) {
        const perAgent = asRecord(config.agents?.[agentId]);
        const agentWorkspace = resolvePath(
          resolveConfigPath(
            openclawDir,
            pickString(perAgent["workspace"], defaultAgentConfig["workspace"], defaultWorkspace) ?? defaultWorkspace,
          ),
        );
        workspaceMap.set(agentId, { workspacePath: agentWorkspace, config: perAgent });
      }
    }
  } catch {
    // no agents dir
  }

  // If nothing found, add the default workspace
  if (workspaceMap.size === 0) {
    workspaceMap.set("main", { workspacePath: defaultWorkspace });
  }

  for (const [agentId, candidate] of workspaceMap.entries()) {
    const workspacePath = candidate.workspacePath;
    const perAgentConfig = candidate.config ?? asRecord(config.agents?.[agentId]);
    const merged = {
      ...globalAgentConfig,
      ...defaultAgentConfig,
      ...perAgentConfig,
    };
    const llmConfig = asRecord(merged["llm"]);

    // Read identity from IDENTITY.md
    const identityContent = readFileOptional(path.join(workspacePath, "IDENTITY.md")) ?? "";
    const nameMatch = identityContent.match(/\*\*Name:\*\*\s*(.+)/);
    const agentName =
      pickString(merged["name"], asRecord(merged["identity"])["name"], nameMatch?.[1], agentId) ?? agentId;
    const model = pickString(
      pickModel(perAgentConfig["model"]),
      asRecord(perAgentConfig["llm"])["model"],
      pickModel(merged["model"]),
      merged["llmModel"],
      merged["defaultModel"],
      llmConfig["model"],
    );
    const role = pickString(merged["role"], merged["agentRole"]);
    const framework = pickString(merged["framework"], merged["platform"], "openclaw");
    const avatar = pickString(
      merged["avatar"],
      asRecord(merged["identity"])["avatar"],
      merged["avatarUrl"],
      merged["image"],
    );
    const memoryPathRaw = pickString(merged["memoryPath"], workspacePath);
    const memoryPath = memoryPathRaw
      ? resolveConfigPath(openclawDir, memoryPathRaw)
      : undefined;
    const skills = pickStringArray(merged["skills"]) ?? pickStringArray(merged["tools"]);
    const channels = Object.keys(asRecord(merged["channels"]));

    agents.push({
      id: agentId,
      name: agentName,
      workspacePath,
      channels,
      model,
      role,
      framework,
      avatar,
      skills,
      memoryPath,
    });

    if (options.includeFiles !== false) {
      workspaces.push({
        agentId,
        path: workspacePath,
        files: {
          soul: readFileOptional(path.join(workspacePath, "SOUL.md")),
          agents: readFileOptional(path.join(workspacePath, "AGENTS.md")),
          tools: readFileOptional(path.join(workspacePath, "TOOLS.md")),
          identity: readFileOptional(path.join(workspacePath, "IDENTITY.md")),
          sessionState: readFileOptional(path.join(workspacePath, "SESSION-STATE.md")),
        },
      });
    }
  }

  return { agents, workspaces, gatewayUrl };
}
