/* eslint-disable no-console -- CLI tool uses console for output */

import { Command } from "commander";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findProjectRoot,
  getWebPidFilePath,
  stopTrackedWebProcess,
} from "../lib/web-process.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveProjectRoot(maybePath?: string): string {
  if (maybePath) return path.resolve(maybePath);

  const fromCwd = findProjectRoot(process.cwd());
  if (fromCwd) return fromCwd;

  return path.resolve(__dirname, "..", "..", "..", "..");
}

export const webCmd = new Command("web").description("Manage the ClawOps web dashboard process");

webCmd
  .command("stop")
  .description("Stop tracked ClawOps web dashboard process")
  .option("--project-root <path>", "ClawOps project root (defaults to auto-detect)")
  .option("--json", "Output result as JSON")
  .action((opts: { projectRoot?: string; json?: boolean }) => {
    const projectRoot = resolveProjectRoot(opts.projectRoot);
    const stopResult = stopTrackedWebProcess(projectRoot);
    const pidFilePath = getWebPidFilePath(projectRoot);

    if (opts.json) {
      console.log(
        JSON.stringify(
          {
            projectRoot,
            ...stopResult,
          },
          null,
          2,
        ),
      );
      return;
    }

    if (stopResult.stopped) {
      console.log(`✓ Dashboard stopped (pid ${stopResult.pid})`);
      console.log(`  PID file: ${pidFilePath}`);
      return;
    }

    if (stopResult.staleRemoved) {
      console.log("✓ Removed stale dashboard PID file");
      console.log(`  PID file: ${pidFilePath}`);
      return;
    }

    if (!stopResult.hadPidFile) {
      console.log("ℹ No tracked dashboard process found");
      console.log(`  PID file: ${pidFilePath}`);
      return;
    }

    console.log("✗ Could not stop tracked dashboard process");
    if (stopResult.reason) {
      console.log(`  Reason: ${stopResult.reason}`);
    }
    console.log(`  PID file: ${pidFilePath}`);
    process.exit(1);
  });
