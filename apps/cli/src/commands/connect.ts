import { Command } from "commander";
import readline from "node:readline";
import { openclaw } from "@clawops/sync";

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer); });
  });
}

export const connectCmd = new Command("connect")
  .description("Connect ClawOps to your OpenClaw setup")
  .option("--openclaw-dir <path>", "OpenClaw directory", "~/.openclaw")
  .option("--gateway-url <url>", "Gateway URL")
  .option("--gateway-token <token>", "Gateway API token")
  .option("--all", "Install skill to all agents without prompting")
  .option("--dry-run", "Show what would be done without writing")
  .action(async (opts) => {
    console.log("\n🔍 Scanning OpenClaw setup...\n");

    const { agents, workspaces, gatewayUrl } = openclaw.scanOpenClaw({
      openclawDir: opts.openclawDir,
      gatewayUrl: opts.gatewayUrl,
    });

    if (agents.length === 0) {
      console.log("❌ No OpenClaw agents found.");
      console.log(`   Looked in: ${opts.openclawDir}`);
      console.log("   Make sure OpenClaw is installed and has been configured.");
      process.exit(1);
    }

    console.log(`✅ Found ${agents.length} agent(s):\n`);
    agents.forEach((a: typeof agents[number], i: number) => {
      console.log(`  [${i + 1}] ${a.name} (${a.id})`);
      console.log(`      Workspace: ${a.workspacePath}`);
    });

    // Fetch from gateway if token provided
    let cronJobs: Awaited<ReturnType<typeof openclaw.fetchGatewayCronJobs>> = [];
    if (opts.gatewayToken) {
      console.log("\n🌐 Connecting to gateway...");
      const [gwAgents, gwCronJobs] = await Promise.all([
        openclaw.fetchGatewayAgents(gatewayUrl, opts.gatewayToken),
        openclaw.fetchGatewayCronJobs(gatewayUrl, opts.gatewayToken),
      ]);
      cronJobs = gwCronJobs;
      if (gwCronJobs.length > 0) {
        console.log(`   Found ${gwCronJobs.length} cron job(s) running`);
      }
      if (gwAgents.length > 0) {
        console.log(`   Found ${gwAgents.length} active session(s)`);
      }
    }

    // Determine which agents to install skill to
    let selectedWorkspaces = workspaces;

    if (!opts.all) {
      console.log("\n📦 Install ClawOps SKILL.md to agent workspaces?");
      console.log("   (This lets agents use `clawops` as their mission control)\n");

      const answer = await prompt(`   Enter numbers (e.g. 1,2) or 'all' or 'skip': `);

      if (answer.toLowerCase() === "skip" || answer.trim() === "") {
        console.log("\n⏭️  Skipped skill installation.");
        console.log("\n✅ OpenClaw connected! Run `clawops connect --all` to install skills later.\n");
        return;
      }

      if (answer.toLowerCase() !== "all") {
        const indices = answer.split(",").map(n => parseInt(n.trim(), 10) - 1).filter(i => !isNaN(i));
        selectedWorkspaces = indices.map(i => workspaces[i]).filter(Boolean);
      }
    }

    if (selectedWorkspaces.length === 0) {
      console.log("\n⚠️  No valid agents selected.\n");
      return;
    }

    console.log(`\n📝 Installing ClawOps skill to ${selectedWorkspaces.length} workspace(s)...`);

    const results: Array<{ agentId: string; path: string; skipped?: boolean }> = [];

    for (const ws of selectedWorkspaces) {
      if (opts.dryRun) {
        const skillPath = `${ws.path}/skills/clawops/SKILL.md`;
        console.log(`   [dry-run] Would write: ${skillPath}`);
        results.push({ agentId: ws.agentId, path: skillPath, skipped: true });
      } else {
        const result = openclaw.installClawOpsSkill(ws.path);
        console.log(`   ✅ ${ws.agentId} → ${result.path}`);
        results.push({ agentId: ws.agentId, path: result.path });
      }
    }

    console.log(`\n🎉 Done! ClawOps is connected to OpenClaw.`);
    if (!opts.dryRun) {
      console.log(`\n   Agents can now use: clawops task list --json`);
      console.log(`   Run \`clawops connect --all\` anytime to re-install/update skills.\n`);
    }
  });
