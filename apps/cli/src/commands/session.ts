/* eslint-disable no-console -- CLI tool uses console for output */

import { Command } from "commander";
import {
  openClawSessionList,
} from "../lib/client.js";
import type { OpenClawSessionRecord, OpenClawSessionStatus } from "@clawops/sync";

export const sessionCmd = new Command("session").description(
  "Inspect OpenClaw runtime sessions",
);

function jsonOut(cmd: Command): boolean {
  return Boolean(cmd.parent?.opts()["json"]);
}

function formatTimestamp(value: Date | null): string {
  return value ? value.toISOString() : "-";
}

function printSessions(title: string, sessions: OpenClawSessionRecord[]): void {
  console.log(title);
  if (sessions.length === 0) {
    console.log("  none");
    return;
  }

  for (const session of sessions) {
    const agentLabel = session.agentId ?? "unknown-agent";
    const modelLabel = session.model ?? "unknown-model";
    const endedLabel = session.endedAt ? ` ended=${formatTimestamp(session.endedAt)}` : "";
    console.log(
      `  ${session.sessionKey} ${session.status} agent=${agentLabel} model=${modelLabel} started=${formatTimestamp(session.startedAt)}${endedLabel}`,
    );
  }
}

sessionCmd
  .command("list")
  .description("List active and recent OpenClaw sessions")
  .option("--connection <id>", "Filter by OpenClaw connection ID")
  .option("--status <status>", "Filter by session status (active|ended)")
  .option("--limit <count>", "Maximum sessions per section", "10")
  .action(async (opts: Record<string, string>) => {
    const limit = Number.parseInt(opts["limit"] ?? "10", 10);
    if (!Number.isFinite(limit) || limit <= 0) {
      console.error("--limit must be a positive integer");
      process.exit(1);
    }

    const connectionId = opts["connection"];
    const status = opts["status"] as OpenClawSessionStatus | undefined;

    if (status && status !== "active" && status !== "ended") {
      console.error("--status must be active or ended");
      process.exit(1);
    }

    if (jsonOut(sessionCmd)) {
      if (status) {
        const sessions = await openClawSessionList({ connectionId, status, limit });
        console.log(JSON.stringify(sessions, null, 2));
        return;
      }

      const [active, recent] = await Promise.all([
        openClawSessionList({ connectionId, status: "active", limit }),
        openClawSessionList({ connectionId, status: "ended", limit }),
      ]);
      console.log(JSON.stringify({ active, recent }, null, 2));
      return;
    }

    if (status) {
      const sessions = await openClawSessionList({ connectionId, status, limit });
      printSessions(status === "active" ? "Active sessions" : "Recent sessions", sessions);
      return;
    }

    const [active, recent] = await Promise.all([
      openClawSessionList({ connectionId, status: "active", limit }),
      openClawSessionList({ connectionId, status: "ended", limit }),
    ]);

    printSessions("Active sessions", active);
    printSessions("Recent sessions", recent);
  });
