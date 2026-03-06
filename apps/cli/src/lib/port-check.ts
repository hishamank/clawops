/* eslint-disable no-console -- CLI tool uses console for output */

import net from "node:net";

export interface PortCheckResult {
  port: number;
  available: boolean;
  usedBy?: string;
}

export async function checkPort(port: number): Promise<PortCheckResult> {
  if (port < 1024) {
    const isRoot = process.getuid?.() === 0;
    if (!isRoot) {
      throw new Error(`Port ${port} is privileged (<1024). Use a port >= 1024 or run as root.`);
    }
  }

  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => {
      resolve({ port, available: false });
    });
    server.once("listening", () => {
      server.close(() => {
        resolve({ port, available: true });
      });
    });
    server.listen(port);
  });
}

export async function findAvailablePort(
  start: number,
  max?: number,
): Promise<number> {
  const limit = max ?? start + 100;
  for (let port = start; port <= limit; port++) {
    const result = await checkPort(port);
    if (result.available) return port;
  }
  throw new Error(
    `No available port found between ${start} and ${limit}`,
  );
}

export async function resolvePort(
  desired: number,
  label: string,
  opts?: { autoResolve?: boolean },
): Promise<number> {
  const autoResolve = opts?.autoResolve ?? true;
  const result = await checkPort(desired);

  if (result.available) return desired;

  if (!autoResolve) {
    throw new Error(
      `Port ${desired} (${label}) is already in use`,
    );
  }

  const next = await findAvailablePort(desired + 1);
  console.log(
    `⚠ Port ${desired} (${label}) is in use, using ${next} instead`,
  );
  return next;
}
