/* eslint-disable no-console -- CLI tool uses console for output */

import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePath(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

interface OnboardResult {
  platform: string;
  openclawDir: string;
  agents: Array<{ id: string; name: string; workspacePath: string }>;
  skillsInstalled: number;
  dashboardStarted: boolean;
  serviceInstalled: boolean;
}

export const onboardCmd = new Command("onboard")
  .description("Interactive onboarding flow to connect ClawOps to an agent platform")
  .option("--openclaw-dir <path>", "Path to openclaw directory", "~/.openclaw")
  .option("--all", "Auto-accept all prompts (non-interactive)")
  .option("--force", "Force overwrite existing skills")
  .option("--dry-run", "Show what would happen without writing anything")
  .option("--json", "Output result as JSON (implies --all)")
  .action(async (opts: Record<string, unknown>) => {
    const isJson = Boolean(opts["json"]);
    const isAll = Boolean(opts["all"]) || isJson;
    const isDryRun = Boolean(opts["dryRun"]);
    const isForce = Boolean(opts["force"]);

    const result: OnboardResult = {
      platform: "openclaw",
      openclawDir: "",
      agents: [],
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

    // Step 3 — Scan & summarize
    const { openclaw } = await import("@clawops/sync");
    const scan = openclaw.scanOpenClaw({ openclawDir, includeFiles: false });

    result.agents = scan.agents.map((a) => ({
      id: a.id,
      name: a.name,
      workspacePath: a.workspacePath,
    }));

    if (!isJson) {
      const names = scan.agents.map((a) => a.id).join(", ");
      console.log(`✓ Found ${scan.agents.length} agents: ${names}`);
      const wsPaths = scan.agents.map((a) => `  ${a.workspacePath}`).join("\n");
      console.log(`  Workspaces:\n${wsPaths}`);
      console.log(`  Gateway: ${scan.gatewayUrl}`);
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
      const syncMod = await import("@clawops/sync");
      for (const agent of scan.agents) {
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
    const apiPort = process.env["API_PORT"] ?? "4444";

    if (startDashboard && !isDryRun) {
      const projectRoot = path.resolve(
        __dirname,
        "..",
        "..",
        "..",
        "..",
      );
      const apiBuild = path.join(projectRoot, "apps", "api", "dist", "index.js");
      const webBuild = path.join(projectRoot, "apps", "web", ".next", "standalone", "server.js");

      if (!fs.existsSync(apiBuild) || !fs.existsSync(webBuild)) {
        console.log(
          "⚠ Dashboard build not found. Run `pnpm build` first, then re-run onboard.",
        );
      } else {
        const apiProc = spawn("node", [apiBuild], {
          detached: true,
          stdio: "ignore",
          env: { ...process.env, API_PORT: apiPort },
        });
        apiProc.unref();

        const webProc = spawn("node", [webBuild], {
          detached: true,
          stdio: "ignore",
          env: { ...process.env, WEB_PORT: webPort },
        });
        webProc.unref();

        result.dashboardStarted = true;
        if (!isJson) {
          console.log("✓ Dashboard started");
          console.log(`  Web: http://localhost:${webPort}`);
          console.log(`  API: http://localhost:${apiPort}`);
          console.log("");
        }
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

        const apiService = `[Unit]
Description=ClawOps API Server
After=network.target

[Service]
Type=simple
EnvironmentFile=${path.join(projectRoot, ".env")}
ExecStart=/usr/bin/env node ${path.join(projectRoot, "apps", "api", "dist", "index.js")}
WorkingDirectory=${projectRoot}
Restart=on-failure

[Install]
WantedBy=default.target
`;
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
          path.join(serviceDir, "clawops-api.service"),
          apiService,
        );
        fs.writeFileSync(
          path.join(serviceDir, "clawops-web.service"),
          webService,
        );

        try {
          const { execSync } = await import("node:child_process");
          execSync("systemctl --user daemon-reload", { stdio: "ignore" });
          execSync(
            "systemctl --user enable --now clawops-api clawops-web",
            { stdio: "ignore" },
          );
          result.serviceInstalled = true;
          if (!isJson) {
            console.log("✓ Systemd user services enabled");
          }
        } catch {
          if (!isJson) {
            console.log("⚠ Failed to enable systemd services. Enable manually:");
            console.log(
              "  systemctl --user daemon-reload && systemctl --user enable --now clawops-api clawops-web",
            );
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

        const apiPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.clawops.api</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/env</string>
    <string>node</string>
    <string>${path.join(projectRoot, "apps", "api", "dist", "index.js")}</string>
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
        const apiPlistPath = path.join(launchDir, "com.clawops.api.plist");
        const webPlistPath = path.join(launchDir, "com.clawops.web.plist");
        fs.writeFileSync(apiPlistPath, apiPlist);
        fs.writeFileSync(webPlistPath, webPlist);

        try {
          const { execSync } = await import("node:child_process");
          execSync(`launchctl load ${apiPlistPath}`, { stdio: "ignore" });
          execSync(`launchctl load ${webPlistPath}`, { stdio: "ignore" });
          result.serviceInstalled = true;
          if (!isJson) {
            console.log("✓ LaunchAgent services loaded");
          }
        } catch {
          if (!isJson) {
            console.log("⚠ Failed to load LaunchAgent services. Load manually:");
            console.log(`  launchctl load ${apiPlistPath}`);
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
      console.log(`  ${result.skillsInstalled} skills installed`);
      console.log(
        `  Dashboard: ${result.dashboardStarted ? "running" : "not started"}`,
      );
      console.log(`  Service: ${serviceLabel}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }
  });
