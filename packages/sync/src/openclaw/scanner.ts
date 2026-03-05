import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { SyncAgent, SyncWorkspace } from "../types.js";
import type { OpenClawConfig, OpenClawScanOptions } from "./types.js";

function resolvePath(p: string): string {
  return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p;
}

function readFileOptional(filePath: string): string | undefined {
  try { return fs.readFileSync(filePath, "utf8"); } catch { return undefined; }
}

export function scanOpenClaw(options: OpenClawScanOptions = {}): {
  agents: SyncAgent[];
  workspaces: SyncWorkspace[];
  gatewayUrl: string;
} {
  const openclawDir = resolvePath(options.openclawDir ?? process.env["OPENCLAW_DIR"] ?? "~/.openclaw");
  const configPath = path.join(openclawDir, "openclaw.json");

  let config: OpenClawConfig = {};
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8")) as OpenClawConfig;
  } catch {
    // No config found, will use defaults
  }

  const gatewayPort = config.gateway?.port ?? 3000;
  const gatewayHost = config.gateway?.host ?? "localhost";
  const gatewayUrl = options.gatewayUrl ?? `http://${gatewayHost}:${gatewayPort}`;

  // Collect agents from config
  const agents: SyncAgent[] = [];
  const workspaces: SyncWorkspace[] = [];

  // Default workspace
  const defaultWorkspace = resolvePath(
    config.agent?.workspace ?? config.agents?.defaults?.workspace ?? "~/.openclaw/workspace"
  );

  // Find all workspace-* directories too (multi-profile)
  const workspaceDirs: Array<{ agentId: string; workspacePath: string }> = [];

  try {
    const entries = fs.readdirSync(openclawDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "workspace" || entry.name.startsWith("workspace-")) {
        const profileId = entry.name === "workspace" ? "main" : entry.name.replace("workspace-", "");
        workspaceDirs.push({
          agentId: profileId,
          workspacePath: path.join(openclawDir, entry.name),
        });
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
      // Check if we already have a workspace for this agent
      if (!workspaceDirs.find(w => w.agentId === agentId)) {
        const agentWorkspace = resolvePath(
          config.agents?.[agentId]?.workspace ?? defaultWorkspace
        );
        workspaceDirs.push({ agentId, workspacePath: agentWorkspace });
      }
    }
  } catch {
    // no agents dir
  }

  // If nothing found, add the default workspace
  if (workspaceDirs.length === 0) {
    workspaceDirs.push({ agentId: "main", workspacePath: defaultWorkspace });
  }

  for (const { agentId, workspacePath } of workspaceDirs) {
    // Read identity from IDENTITY.md
    const identityContent = readFileOptional(path.join(workspacePath, "IDENTITY.md")) ?? "";
    const nameMatch = identityContent.match(/\*\*Name:\*\*\s*(.+)/);
    const agentName = nameMatch?.[1]?.trim() ?? agentId;

    agents.push({
      id: agentId,
      name: agentName,
      workspacePath,
      channels: [],
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
