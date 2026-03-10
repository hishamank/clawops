import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const PID_FILE_NAME = ".clawops-web.pid";

export interface WebProcessRecord {
  pid: number;
  port: number;
  runtime: "standalone" | "next-start";
  startedAt: string;
  projectRoot: string;
}

export interface StopWebProcessResult {
  pidFilePath: string;
  hadPidFile: boolean;
  stopped: boolean;
  staleRemoved: boolean;
  pid?: number;
  reason?: string;
}

export function findProjectRoot(startDir = process.cwd()): string | null {
  let current = path.resolve(startDir);
  const { root } = path.parse(current);

  while (true) {
    const hasWorkspace = fs.existsSync(path.join(current, "pnpm-workspace.yaml"));
    const hasPackageJson = fs.existsSync(path.join(current, "package.json"));
    if (hasWorkspace && hasPackageJson) {
      return current;
    }
    if (current === root) {
      return null;
    }
    current = path.dirname(current);
  }
}

export function getWebPidFilePath(projectRoot: string): string {
  return path.join(projectRoot, PID_FILE_NAME);
}

export function readWebProcessRecord(projectRoot: string): WebProcessRecord | null {
  const pidFilePath = getWebPidFilePath(projectRoot);
  if (!fs.existsSync(pidFilePath)) return null;

  try {
    const raw = fs.readFileSync(pidFilePath, "utf8").trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WebProcessRecord>;
    if (
      typeof parsed.pid !== "number" ||
      typeof parsed.port !== "number" ||
      (parsed.runtime !== "standalone" && parsed.runtime !== "next-start")
    ) {
      return null;
    }
    return {
      pid: parsed.pid,
      port: parsed.port,
      runtime: parsed.runtime,
      startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : new Date().toISOString(),
      projectRoot,
    };
  } catch {
    return null;
  }
}

export function writeWebProcessRecord(
  projectRoot: string,
  record: Omit<WebProcessRecord, "projectRoot" | "startedAt"> & { startedAt?: string },
): string {
  const pidFilePath = getWebPidFilePath(projectRoot);
  const payload: WebProcessRecord = {
    pid: record.pid,
    port: record.port,
    runtime: record.runtime,
    startedAt: record.startedAt ?? new Date().toISOString(),
    projectRoot,
  };
  fs.writeFileSync(pidFilePath, `${JSON.stringify(payload, null, 2)}\n`);
  return pidFilePath;
}

export function clearWebProcessRecord(projectRoot: string): void {
  const pidFilePath = getWebPidFilePath(projectRoot);
  if (fs.existsSync(pidFilePath)) {
    fs.unlinkSync(pidFilePath);
  }
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getProcessCommand(pid: number): string {
  const result = spawnSync("ps", ["-p", String(pid), "-o", "command="], {
    encoding: "utf8",
  });
  if (result.status !== 0) return "";
  return result.stdout.trim();
}

function waitForExit(pid: number, timeoutMs: number): boolean {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!isPidAlive(pid)) return true;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  return !isPidAlive(pid);
}

function looksLikeClawopsWebProcess(pid: number): boolean {
  const cmd = getProcessCommand(pid).toLowerCase();
  if (!cmd) return true;
  return cmd.includes("next") || cmd.includes("clawops");
}

export function stopTrackedWebProcess(projectRoot: string): StopWebProcessResult {
  const pidFilePath = getWebPidFilePath(projectRoot);
  const record = readWebProcessRecord(projectRoot);
  const hadPidFile = fs.existsSync(pidFilePath);

  if (!record) {
    if (hadPidFile) {
      clearWebProcessRecord(projectRoot);
      return {
        pidFilePath,
        hadPidFile: true,
        stopped: false,
        staleRemoved: true,
        reason: "invalid-pid-file",
      };
    }
    return {
      pidFilePath,
      hadPidFile: false,
      stopped: false,
      staleRemoved: false,
      reason: "no-pid-file",
    };
  }

  if (!isPidAlive(record.pid)) {
    clearWebProcessRecord(projectRoot);
    return {
      pidFilePath,
      hadPidFile,
      stopped: false,
      staleRemoved: true,
      pid: record.pid,
      reason: "stale-pid",
    };
  }

  if (!looksLikeClawopsWebProcess(record.pid)) {
    return {
      pidFilePath,
      hadPidFile,
      stopped: false,
      staleRemoved: false,
      pid: record.pid,
      reason: "pid-not-clawops-like",
    };
  }

  try {
    process.kill(record.pid, "SIGTERM");
  } catch {
    clearWebProcessRecord(projectRoot);
    return {
      pidFilePath,
      hadPidFile,
      stopped: false,
      staleRemoved: true,
      pid: record.pid,
      reason: "already-exited",
    };
  }

  const exitedAfterTerm = waitForExit(record.pid, 3000);
  if (!exitedAfterTerm) {
    try {
      process.kill(record.pid, "SIGKILL");
    } catch {
      // Ignore final kill failures.
    }
    waitForExit(record.pid, 1500);
  }

  const alive = isPidAlive(record.pid);
  if (!alive) {
    clearWebProcessRecord(projectRoot);
    return {
      pidFilePath,
      hadPidFile,
      stopped: true,
      staleRemoved: false,
      pid: record.pid,
      reason: "stopped",
    };
  }

  return {
    pidFilePath,
    hadPidFile,
    stopped: false,
    staleRemoved: false,
    pid: record.pid,
    reason: "kill-failed",
  };
}
