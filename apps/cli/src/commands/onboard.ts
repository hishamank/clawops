/* eslint-disable no-console -- CLI tool uses console for output */

import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  stopTrackedWebProcess,
  writeWebProcessRecord,
  getWebPidFilePath,
} from "../lib/web-process.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePath(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

function parseEnvFile(envPath: string): Record<string, string> {
  if (!fs.existsSync(envPath)) return {};
  const result: Record<string, string> = {};
  const content = fs.readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

interface OnboardResult {
  platform: string;
  openclawDir: string;
  agents: Array<{ id: string; name: string; workspacePath: string }>;
  agentsRegistered: number;
  skillsInstalled: number;
  dashboardStarted: boolean;
  dashboardMode?: "prod";
  dashboardWebRuntime?: "standalone" | "next-start";
  serviceInstalled: boolean;
}

function formatFileState(filePath: string): string {
  if (!fs.existsSync(filePath)) return "missing";
  try {
    const st = fs.statSync(filePath);
    if (st.isFile()) return `file (${st.size} bytes)`;
    if (st.isDirectory()) return "dir";
    return "other";
  } catch (err) {
    return `exists (stat error: ${err instanceof Error ? err.message : String(err)})`;
  }
}

export const onboardCmd = new Command("onboard")
  .description("Interactive onboarding flow to connect ClawOps to an agent platform")
  .option("--openclaw-dir <path>", "Path to openclaw directory", "~/.openclaw")
  .option("--all", "Auto-accept all prompts (non-interactive)")
  .option("--force", "Force overwrite existing skills")
  .option("--dry-run", "Show what would happen without writing anything")
  .option("--debug", "Print verbose onboarding diagnostics")
  .option("--json", "Output result as JSON (implies --all)")
  .action(async (opts: Record<string, unknown>) => {
    const isJson = Boolean(opts["json"]);
    const isAll = Boolean(opts["all"]) || isJson;
    const isDryRun = Boolean(opts["dryRun"]);
    const isForce = Boolean(opts["force"]);
    const isDebug = Boolean(opts["debug"]) || process.env["CLAWOPS_DEBUG"] === "1";
    const debug = (message: string, meta?: Record<string, unknown>): void => {
      if (!isDebug) return;
      if (meta) {
        console.error(`[onboard:debug] ${message} ${JSON.stringify(meta)}`);
        return;
      }
      console.error(`[onboard:debug] ${message}`);
    };

    const result: OnboardResult = {
      platform: "openclaw",
      openclawDir: "",
      agents: [],
      agentsRegistered: 0,
      skillsInstalled: 0,
      dashboardStarted: false,
      serviceInstalled: false,
    };

    // Step 1 — Platform selection
    if (!isJson) {
      console.log("");
    }
    let selectedPlatform = "openclaw";
    if (!isAll) {
      const { select } = await import("@inquirer/prompts");
      selectedPlatform = await select({
        message: "Which platform are you connecting to?",
        choices: [
          { value: "openclaw", name: "OpenClaw" },
          { value: "other", name: "(more coming soon)", disabled: true },
        ],
      });
    }
    result.platform = selectedPlatform;

    // Step 2 — Directory
    let openclawDir = resolvePath(opts["openclawDir"] as string);
    if (!isAll) {
      const { input } = await import("@inquirer/prompts");
      const answer = await input({
        message: "OpenClaw directory:",
        default: openclawDir,
      });
      openclawDir = resolvePath(answer);
    }
    result.openclawDir = openclawDir;
    debug("resolved OpenClaw directory", { openclawDir });

    // Validate directory
    if (!fs.existsSync(openclawDir)) {
      console.error(`✗ Directory not found: ${openclawDir}`);
      process.exit(1);
    }

    const hasConfig = fs.existsSync(path.join(openclawDir, "openclaw.json"));
    const hasWorkspaces = fs.readdirSync(openclawDir).some(
      (e) => e === "workspace" || e.startsWith("workspace-"),
    );
    if (!hasConfig && !hasWorkspaces) {
      console.error(
        `✗ ${openclawDir} does not look like an OpenClaw directory (no openclaw.json or workspace dirs)`,
      );
      process.exit(1);
    }
    debug("OpenClaw directory validation", { hasConfig, hasWorkspaces });

    // Step 3 — Scan and run shared onboarding side effects
    const syncMod = await import("@clawops/sync");
    const scan = isDryRun
      ? syncMod.openclaw.scanOpenClaw({ openclawDir, includeFiles: false })
      : null;

    // Ensure migrations are run before any DB operations
    if (!isDryRun) {
      const { ensureMigrated } = await import("../lib/client.js");
      ensureMigrated();
    }

    const onboarding = isDryRun
      ? null
      : await syncMod.onboardOpenClaw((await import("@clawops/core/db")).db, {
          openclawDir,
          includeFiles: false,
          source: "cli.onboard",
        });
    const discoveredAgents = onboarding?.agents ?? scan?.agents ?? [];
    const gatewayUrl = onboarding?.gatewayUrl ?? scan?.gatewayUrl ?? "";
    debug("scan summary", { agentCount: discoveredAgents.length, gatewayUrl });

    result.openclawDir = onboarding?.openclawDir ?? openclawDir;
    result.agents = discoveredAgents.map((agent: { id: string; name: string; workspacePath: string }) => ({
      id: agent.id,
      name: agent.name,
      workspacePath: agent.workspacePath,
    }));
    result.agentsRegistered = onboarding
      ? onboarding.agentRegistrations.filter((registration) => registration.created).length
      : discoveredAgents.length;

    if (!isJson) {
      const names = discoveredAgents.map((agent: { id: string }) => agent.id).join(", ");
      console.log(`✓ Found ${discoveredAgents.length} agents: ${names}`);
      const wsPaths = discoveredAgents
        .map((agent: { workspacePath: string }) => `  ${agent.workspacePath}`)
        .join("\n");
      console.log(`  Workspaces:\n${wsPaths}`);
      console.log(`  Gateway: ${gatewayUrl}`);
      console.log("");
      console.log(
        isDryRun
          ? `✓ Agent registry would be updated (${result.agentsRegistered} discovered)`
          : `✓ Agent registry updated (${result.agentsRegistered} new)`,
      );
      console.log("");
    }

    // Step 4 — Install skill
    let installSkills = isAll;
    if (!isAll) {
      const { confirm } = await import("@inquirer/prompts");
      installSkills = await confirm({
        message: "Install ClawOps skill into agent workspaces?",
        default: true,
      });
    }

    if (installSkills) {
      for (const agent of discoveredAgents) {
        const skillPath = path.join(
          agent.workspacePath,
          "skills",
          "clawops",
          "SKILL.md",
        );
        const alreadyExists = fs.existsSync(skillPath);

        if (alreadyExists) {
          if (isForce) {
            // overwrite
          } else if (isAll || isJson) {
            // skip silently in non-interactive
            continue;
          } else {
            // prompt: overwrite? default: no
            const { confirm } = await import("@inquirer/prompts");
            const overwrite = await confirm({ message: `Skill exists in ${agent.workspacePath}. Overwrite?`, default: false });
            if (!overwrite) continue;
          }
        }

        if (isDryRun) {
          if (!isJson) {
            console.log(`  Would write skill to ${skillPath}`);
          }
          result.skillsInstalled++;
          continue;
        }

        const installResult = syncMod.openclaw.installClawOpsSkill(agent.workspacePath);
        if (installResult.installed) {
          result.skillsInstalled++;
          if (!isJson) {
            console.log(`  Writing skill to ${installResult.path} ✓`);
          }
        } else {
          if (!isJson) {
            console.error(
              `  ✗ Failed to install skill for ${agent.id}: ${installResult.error}`,
            );
          }
        }
      }
      if (!isJson) {
        console.log("");
      }
    }

    // Step 5 — Dashboard
    let startDashboard = false;
    if (!isAll) {
      const { confirm } = await import("@inquirer/prompts");
      startDashboard = await confirm({
        message: "Do you want to run the ClawOps dashboard now?",
        default: false,
      });
    }

    const webPort = process.env["WEB_PORT"] ?? "3333";

    if (startDashboard && !isDryRun) {
      const projectRoot = path.resolve(
        __dirname,
        "..",
        "..",
        "..",
        "..",
      );
      const webStandaloneBuild = path.join(
        projectRoot,
        "apps",
        "web",
        ".next",
        "standalone",
        "server.js",
      );
      const webBuildId = path.join(projectRoot, "apps", "web", ".next", "BUILD_ID");
      const envFromFile = parseEnvFile(path.join(projectRoot, ".env"));
      const runtimeEnv: NodeJS.ProcessEnv = {
        ...envFromFile,
        ...process.env,
        WEB_PORT: webPort,
        PORT: webPort,
      };
      const configuredDbPath = runtimeEnv["CLAWOPS_DB_PATH"];
      runtimeEnv["CLAWOPS_DB_PATH"] =
        configuredDbPath && path.isAbsolute(configuredDbPath)
          ? configuredDbPath
          : path.join(projectRoot, configuredDbPath ?? "clawops.db");
      const stopResult = stopTrackedWebProcess(projectRoot);
      debug("existing tracked web process stop result", { ...stopResult });
      if (!isJson && stopResult.stopped) {
        console.log("⚠ Stopped existing tracked dashboard process before restart");
      }
      debug("dashboard start context", { projectRoot, webPort });
      debug("build artifacts before build", {
        webStandaloneBuild: formatFileState(webStandaloneBuild),
        webBuildId: formatFileState(webBuildId),
      });
      const hasProdBuild = fs.existsSync(webStandaloneBuild) || fs.existsSync(webBuildId);

      if (!hasProdBuild) {
        if (!isJson) {
          console.log("⚠ Dashboard build not found. Building project first...");
        }
        const pnpmCmd = os.platform() === "win32" ? "pnpm.cmd" : "pnpm";
        debug("running build command", { cmd: pnpmCmd, args: ["build"], cwd: projectRoot });
        const buildResult = spawnSync(pnpmCmd, ["build"], {
          cwd: projectRoot,
          stdio: "inherit",
          env: runtimeEnv,
        });
        debug("build command finished", {
          status: buildResult.status,
          signal: buildResult.signal,
          error: buildResult.error ? String(buildResult.error) : undefined,
        });
        if (buildResult.status !== 0) {
          if (!isJson) {
            console.log("✗ Build failed. Dashboard was not started.");
            console.log("");
          }
        }
      }

      const hasWebStandaloneBuild = fs.existsSync(webStandaloneBuild);
      const hasWebNextBuild = fs.existsSync(webBuildId);
      debug("build artifacts after build", {
        webStandaloneBuild: formatFileState(webStandaloneBuild),
        webBuildId: formatFileState(webBuildId),
      });
      if (isDebug) {
        const webNextDir = path.join(projectRoot, "apps", "web", ".next");
        if (fs.existsSync(webNextDir)) {
          try {
            const entries = fs.readdirSync(webNextDir).slice(0, 40);
            debug(".next directory entries", { entries });
          } catch (err) {
            debug("failed listing .next directory", {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        } else {
          debug(".next directory missing", { webNextDir });
        }
      }
      const buildAvailable = hasWebStandaloneBuild || hasWebNextBuild;
      if (buildAvailable) {
        if (hasWebStandaloneBuild) {
          const webProc = spawn("node", [webStandaloneBuild], {
            detached: true,
            stdio: "ignore",
            env: runtimeEnv,
          });
          webProc.on("error", (err) => {
            debug("failed to spawn web standalone process", { error: err.message });
          });
          debug("spawned web standalone process", {
            cmd: "node",
            args: [webStandaloneBuild],
            pid: webProc.pid ?? null,
          });
          if (webProc.pid) {
            const pidFilePath = writeWebProcessRecord(projectRoot, {
              pid: webProc.pid,
              port: Number(webPort),
              runtime: "standalone",
            });
            debug("wrote web process pid file", { pidFilePath, pid: webProc.pid });
          }
          webProc.unref();
          result.dashboardWebRuntime = "standalone";
        } else {
          const pnpmCmd = os.platform() === "win32" ? "pnpm.cmd" : "pnpm";
          const webProc = spawn(
            pnpmCmd,
            ["--filter", "@clawops/web", "exec", "next", "start", "-p", webPort],
            {
              cwd: projectRoot,
              detached: true,
              stdio: "ignore",
              env: runtimeEnv,
            },
          );
          webProc.on("error", (err) => {
            debug("failed to spawn web next-start process", { error: err.message });
          });
          debug("spawned web next-start process", {
            cmd: pnpmCmd,
            args: ["--filter", "@clawops/web", "exec", "next", "start", "-p", webPort],
            pid: webProc.pid ?? null,
          });
          if (webProc.pid) {
            const pidFilePath = writeWebProcessRecord(projectRoot, {
              pid: webProc.pid,
              port: Number(webPort),
              runtime: "next-start",
            });
            debug("wrote web process pid file", { pidFilePath, pid: webProc.pid });
          }
          webProc.unref();
          result.dashboardWebRuntime = "next-start";
        }

        result.dashboardStarted = true;
        result.dashboardMode = "prod";
        if (!isJson) {
          console.log("✓ Dashboard started");
          console.log("  Mode: production");
          if (result.dashboardWebRuntime) {
            console.log(`  Web runtime: ${result.dashboardWebRuntime}`);
          }
          console.log(`  Web: http://localhost:${webPort}`);
          console.log(`  PID file: ${getWebPidFilePath(projectRoot)}`);
          console.log("");
        }
      } else if (!isJson) {
        debug("build artifacts check failed", { hasWebStandaloneBuild, hasWebNextBuild });
        console.log("✗ Production build artifacts still missing. Dashboard was not started.");
        console.log("");
      }
    }

    // Step 6 — System service
    let installService = false;
    if (!isAll) {
      const { confirm } = await import("@inquirer/prompts");
      installService = await confirm({
        message:
          "Do you want ClawOps to start automatically on system boot?",
        default: false,
      });
    }

    if (installService && !isDryRun) {
      const osPlatform = os.platform();
      const projectRoot = path.resolve(
        __dirname,
        "..",
        "..",
        "..",
        "..",
      );

      // Detect WSL
      const isWSL =
        osPlatform === "linux" &&
        fs.existsSync("/proc/version") &&
        fs.readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft");

      if (isWSL) {
        if (!isJson) {
          console.log(
            "⚠ WSL detected. Automatic service setup is not supported on WSL.",
          );
          console.log(
            "  You can manually add ClawOps to your shell profile or use Task Scheduler.",
          );
          console.log("");
        }
      } else if (osPlatform === "linux") {
        // systemd user service
        const serviceDir = path.join(
          os.homedir(),
          ".config",
          "systemd",
          "user",
        );
        fs.mkdirSync(serviceDir, { recursive: true });

        const webService = `[Unit]
Description=ClawOps Web Dashboard
After=network.target

[Service]
Type=simple
EnvironmentFile=${path.join(projectRoot, ".env")}
ExecStart=/usr/bin/env node ${path.join(projectRoot, "apps", "web", ".next", "standalone", "server.js")}
WorkingDirectory=${projectRoot}
Restart=on-failure

[Install]
WantedBy=default.target
`;
        fs.writeFileSync(
          path.join(serviceDir, "clawops-web.service"),
          webService,
        );

        try {
          const { execSync } = await import("node:child_process");
          execSync("systemctl --user daemon-reload", { stdio: "ignore" });
          execSync("systemctl --user enable --now clawops-web", { stdio: "ignore" });
          result.serviceInstalled = true;
          if (!isJson) {
            console.log("✓ Systemd user service enabled");
          }
        } catch {
          if (!isJson) {
            console.log("⚠ Failed to enable systemd service. Enable manually:");
            console.log("  systemctl --user daemon-reload && systemctl --user enable --now clawops-web");
          }
        }
      } else if (osPlatform === "darwin") {
        // launchd
        const launchDir = path.join(
          os.homedir(),
          "Library",
          "LaunchAgents",
        );
        fs.mkdirSync(launchDir, { recursive: true });

        const webPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.clawops.web</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/env</string>
    <string>node</string>
    <string>${path.join(projectRoot, "apps", "web", ".next", "standalone", "server.js")}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${projectRoot}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
`;
        const webPlistPath = path.join(launchDir, "com.clawops.web.plist");
        fs.writeFileSync(webPlistPath, webPlist);

        try {
          const { execSync } = await import("node:child_process");
          execSync(`launchctl load ${webPlistPath}`, { stdio: "ignore" });
          result.serviceInstalled = true;
          if (!isJson) {
            console.log("✓ LaunchAgent service loaded");
          }
        } catch {
          if (!isJson) {
            console.log("⚠ Failed to load LaunchAgent service. Load manually:");
            console.log(`  launchctl load ${webPlistPath}`);
          }
        }
      }
      if (!isJson) {
        console.log("");
      }
    }

    // Final summary
    if (isJson) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      const osPlatform = os.platform();
      const serviceLabel = result.serviceInstalled
        ? `enabled (${osPlatform === "darwin" ? "launchd" : "systemd"})`
        : "not installed";

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`✓ ClawOps connected to OpenClaw`);
      console.log(`  ${result.agents.length} agents found`);
      console.log(`  ${result.agentsRegistered} agents registered`);
      console.log(`  ${result.skillsInstalled} skills installed`);
      console.log(
        `  Dashboard: ${result.dashboardStarted ? "running" : "not started"}`,
      );
      if (result.dashboardStarted && result.dashboardMode) {
        console.log(`  Dashboard mode: ${result.dashboardMode}`);
        if (result.dashboardWebRuntime) {
          console.log(`  Web runtime: ${result.dashboardWebRuntime}`);
        }
      }
      console.log(`  Service: ${serviceLabel}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }
  });
