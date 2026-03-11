/* eslint-disable no-console -- CLI tool uses console for output */

import { Command } from "commander";
import type { Habit } from "@clawops/core";

export const cronCmd = new Command("cron").description("Manage OpenClaw cron jobs");

function jsonOut(cmd: Command): boolean {
  return Boolean(cmd.parent?.opts()["json"]);
}

function getGatewayToken(opts: Record<string, unknown>): string | undefined {
  return (opts["gatewayToken"] as string | undefined) ?? process.env["OPENCLAW_GATEWAY_TOKEN"] ?? undefined;
}

cronCmd
  .command("list")
  .description("List synced OpenClaw cron jobs")
  .option("--connection <id>", "Filter by OpenClaw connection ID")
  .action(async (opts: Record<string, unknown>) => {
    const { db } = await import("@clawops/core/db");
    const { listCronJobs } = await import("@clawops/habits");

    const jobs: Habit[] = listCronJobs(db, {
      connectionId: opts["connection"] as string | undefined,
    });

    if (jsonOut(cronCmd)) {
      console.log(JSON.stringify(jobs, null, 2));
      return;
    }

    for (const job of jobs) {
      console.log(
        `${job.id} ${job.name} ${job.enabled ? "enabled" : "disabled"} ${job.scheduleKind ?? "cron"} ${job.scheduleExpr ?? ""}`.trim(),
      );
    }
  });

async function setEnabled(
  id: string,
  enabled: boolean,
  opts: Record<string, unknown>,
): Promise<void> {
  const { db } = await import("@clawops/core/db");
  const { updateConnectionCronJob } = await import("@clawops/habits");

  const result = await updateConnectionCronJob(
    db,
    id,
    { enabled },
    getGatewayToken(opts),
  );

  if (jsonOut(cronCmd)) {
    console.log(JSON.stringify(result.local, null, 2));
  } else {
    console.log(`cron job ${result.local.id} ${enabled ? "enabled" : "disabled"}`);
  }
}

cronCmd
  .command("enable <id>")
  .description("Enable an OpenClaw cron job")
  .option("--gateway-token <token>", "Gateway token for the OpenClaw connection")
  .action(async (id: string, opts: Record<string, unknown>) => {
    await setEnabled(id, true, opts);
  });

cronCmd
  .command("disable <id>")
  .description("Disable an OpenClaw cron job")
  .option("--gateway-token <token>", "Gateway token for the OpenClaw connection")
  .action(async (id: string, opts: Record<string, unknown>) => {
    await setEnabled(id, false, opts);
  });
