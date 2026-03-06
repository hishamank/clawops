/* eslint-disable no-console -- CLI tool uses console for output */

import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function resolvePath(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

interface SyncJsonResult {
  syncedAt: string;
  agents: { total: number; added: string[]; removed: string[] };
  skills: { installed: number; skipped: number };
  cronJobs: { total: number };
}

export const syncCmd = new Command("sync")
  .description("Sync ClawOps with OpenClaw agents and workspaces")
  .option("--openclaw-dir <path>", "Path to openclaw directory")
  .option("--gateway-url <url>", "Gateway URL")
  .option("--gateway-token <token>", "Gateway token")
  .option("--reinstall-skills", "Force reinstall the ClawOps skill (skills/clawops/SKILL.md) even if already present")
  .option("--dry-run", "Show what would change without writing")
  .option("--json", "Output result as JSON")
  .action(async (opts: Record<string, unknown>) => {
    const isJson = Boolean(opts["json"]);
    const isDryRun = Boolean(opts["dryRun"]);
    const reinstallSkills = Boolean(opts["reinstallSkills"]);

    // Resolve config from options, env vars, or .env file
    const openclawDir = resolvePath(
      (opts["openclawDir"] as string | undefined) ??
        process.env["OPENCLAW_DIR"] ??
        "~/.openclaw",
    );
    const gatewayUrl =
      (opts["gatewayUrl"] as string | undefined) ??
      process.env["OPENCLAW_GATEWAY_URL"] ??
      undefined;
    const gatewayToken =
      (opts["gatewayToken"] as string | undefined) ??
      process.env["OPENCLAW_GATEWAY_TOKEN"] ??
      undefined;

    if (!isJson) {
      console.log(`→ Syncing OpenClaw at ${openclawDir}...`);
    }

    // Scan
    const { openclaw } = await import("@clawops/sync");
    const scan = openclaw.scanOpenClaw({
      openclawDir,
      gatewayUrl,
      includeFiles: false,
    });

    // Load previous sync state for diff
    const stateFile = path.join(openclawDir, ".clawops-sync-state.json");
    let previousAgentIds: string[] = [];
    try {
      const raw = fs.readFileSync(stateFile, "utf8");
      const state = JSON.parse(raw) as { agentIds?: string[] };
      previousAgentIds = state.agentIds ?? [];
    } catch {
      // No previous state
    }

    const currentAgentIds = scan.agents.map((a: { id: string }) => a.id);
    const addedAgents = currentAgentIds.filter(
      (id: string) => !previousAgentIds.includes(id),
    );
    const removedAgents = previousAgentIds.filter(
      (id: string) => !currentAgentIds.includes(id),
    );

    // Install skills
    let installed = 0;
    let skipped = 0;

    for (const agent of scan.agents) {
      const skillPath = path.join(
        agent.workspacePath,
        "skills",
        "clawops",
        "SKILL.md",
      );
      const exists = fs.existsSync(skillPath);

      if (exists && !reinstallSkills) {
        skipped++;
        continue;
      }

      if (isDryRun) {
        installed++;
        continue;
      }

      const result = openclaw.installClawOpsSkill(agent.workspacePath);
      if (result.installed) {
        installed++;
      } else {
        skipped++;
        if (!isJson) {
          console.error(`  ✗ Failed to install skill for ${agent.id}: ${result.error}`);
        }
      }
    }

    // Fetch gateway data if token provided
    let cronJobCount = 0;
    if (gatewayToken && scan.gatewayUrl) {
      const [, cronJobs] = await Promise.all([
        openclaw.fetchGatewayAgents(scan.gatewayUrl, gatewayToken),
        openclaw.fetchGatewayCronJobs(scan.gatewayUrl, gatewayToken),
      ]);
      cronJobCount = cronJobs.length;
    }

    // Save sync state
    if (!isDryRun) {
      try {
        fs.writeFileSync(
          stateFile,
          JSON.stringify({ agentIds: currentAgentIds, syncedAt: new Date().toISOString() }),
        );
      } catch {
        // Non-critical
      }
    }

    const jsonResult: SyncJsonResult = {
      syncedAt: new Date().toISOString(),
      agents: {
        total: scan.agents.length,
        added: addedAgents,
        removed: removedAgents,
      },
      skills: { installed, skipped },
      cronJobs: { total: cronJobCount },
    };

    // Determine exit code
    const nothingChanged =
      addedAgents.length === 0 &&
      removedAgents.length === 0 &&
      installed === 0;

    if (isJson) {
      console.log(JSON.stringify(jsonResult, null, 2));
    } else {
      const addedLabel =
        addedAgents.length > 0
          ? ` (${addedAgents.length} new: ${addedAgents.join(", ")})`
          : "";
      const removedLabel =
        removedAgents.length > 0
          ? ` (${removedAgents.length} removed: ${removedAgents.join(", ")})`
          : "";
      console.log(
        `✓ Agents: ${scan.agents.length} found${addedLabel}${removedLabel}`,
      );

      const skillLabel =
        installed > 0
          ? ` (${scan.agents
              .filter((a: { id: string; workspacePath: string }) => {
                const sp = path.join(a.workspacePath, "skills", "clawops", "SKILL.md");
                return reinstallSkills || !fs.existsSync(sp) || addedAgents.includes(a.id);
              })
              .map((a: { id: string }) => a.id)
              .join(", ")})`
          : "";
      console.log(
        `✓ Skills: ${installed} installed${skillLabel}, ${skipped} skipped`,
      );

      if (gatewayToken) {
        console.log(`✓ Cron jobs: ${cronJobCount} fetched from gateway`);
      }

      console.log("Sync complete ✓");
    }

    if (nothingChanged) {
      process.exit(2);
    }
  });
