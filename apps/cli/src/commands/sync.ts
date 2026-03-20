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
  registry: { created: number };
  skills: { installed: number; skipped: number };
  cronJobs: { total: number };
  usage?: { imported: number; rescannedFiles: number };
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

    const syncMod = await import("@clawops/sync");
    const scan = isDryRun
      ? syncMod.openclaw.scanOpenClaw({
          openclawDir,
          gatewayUrl,
          includeFiles: false,
        })
      : null;
    const onboarding = isDryRun
      ? null
      : await syncMod.onboardOpenClaw((await import("@clawops/core/db")).db, {
          source: "cli.sync",
          openclawDir,
          gatewayUrl,
          gatewayToken,
          includeFiles: false,
        });
    const usageSync = onboarding
      ? await syncMod.reconcileConnection((await import("@clawops/core/db")).db, onboarding.connectionId, {
          mode: "usage",
        })
      : null;
    const discoveredAgents = onboarding?.agents ?? scan?.agents ?? [];
    const gatewayEndpoint = onboarding?.gatewayUrl ?? scan?.gatewayUrl ?? gatewayUrl ?? "";

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

    const currentAgentIds = discoveredAgents.map((a: { id: string }) => a.id);
    const addedAgents = currentAgentIds.filter(
      (id: string) => !previousAgentIds.includes(id),
    );
    const removedAgents = previousAgentIds.filter(
      (id: string) => !currentAgentIds.includes(id),
    );

    const registryCreated = onboarding
      ? onboarding.agentRegistrations.filter((registration: { created: boolean }) => registration.created).length
      : discoveredAgents.length;

    // Install skills
    let installed = 0;
    let skipped = 0;

    for (const agent of discoveredAgents) {
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

      const result = syncMod.openclaw.installClawOpsSkill(agent.workspacePath);
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
    if (gatewayToken && gatewayEndpoint) {
      const [, cronJobs] = await Promise.all([
        syncMod.openclaw.fetchGatewayAgents(gatewayEndpoint, gatewayToken),
        syncMod.openclaw.fetchGatewayCronJobs(gatewayEndpoint, gatewayToken),
      ]);
      cronJobCount = cronJobs.length;
    }

    // Save sync state and emit activity event
    if (!isDryRun) {
      try {
        fs.writeFileSync(
          stateFile,
          JSON.stringify({ agentIds: currentAgentIds, syncedAt: new Date().toISOString() }),
        );
      } catch {
        // Non-critical
      }

      const { createActivityEvent } = await import("@clawops/core");
      const { db: activityDb } = await import("@clawops/core/db");
      try {
        createActivityEvent(activityDb, {
          source: "sync",
          type: "sync.completed",
          title: `CLI sync completed: ${discoveredAgents.length} agents, ${cronJobCount} cron jobs`,
          entityType: "sync_run",
          metadata: JSON.stringify({
            agentCount: discoveredAgents.length,
            cronJobCount,
            addedAgents,
            removedAgents,
            registryCreated,
            skillsInstalled: installed,
          }),
        });
      } catch {
        // Non-critical
      }
    }

    const jsonResult: SyncJsonResult = {
      syncedAt: new Date().toISOString(),
      agents: {
        total: discoveredAgents.length,
        added: addedAgents,
        removed: removedAgents,
      },
      registry: { created: registryCreated },
      skills: { installed, skipped },
      cronJobs: { total: cronJobCount },
      usage: usageSync
        ? {
            imported: usageSync.addedCount,
            rescannedFiles: usageSync.updatedCount,
          }
        : undefined,
    };

    // Determine exit code
    const nothingChanged =
      addedAgents.length === 0 &&
      removedAgents.length === 0 &&
      installed === 0 &&
      registryCreated === 0 &&
      (usageSync === null || (usageSync.addedCount === 0 && usageSync.updatedCount === 0));

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
        `✓ Agents: ${discoveredAgents.length} found${addedLabel}${removedLabel}`,
      );
      console.log(`✓ Registry: ${registryCreated} new agent records created`);

      const skillLabel =
        installed > 0
          ? ` (${discoveredAgents
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
      if (usageSync) {
        console.log(
          `✓ Usage: ${usageSync.addedCount} entries imported, ${usageSync.updatedCount} files rescanned`,
        );
      }

      if (gatewayToken) {
        console.log(`✓ Cron jobs: ${cronJobCount} fetched from gateway`);
      }

      console.log("Sync complete ✓");
    }

    if (nothingChanged) {
      process.exit(2);
    }
  });
