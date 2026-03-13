/* eslint-disable no-console -- CLI tool uses console for output */

import { Command } from "commander";
import { getAgentId } from "../lib/client.js";
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
    const { events } = await import("@clawops/core");
    const { listCronJobs } = await import("@clawops/habits");

    const jobs: Habit[] = listCronJobs(db, {
      connectionId: opts["connection"] as string | undefined,
    });

    db.insert(events)
      .values({
        agentId: process.env["CLAWOPS_AGENT_ID"] ?? null,
        action: "openclaw.cron_jobs.listed",
        entityType: "habit",
        entityId: "*",
        meta: JSON.stringify({
          connectionId: opts["connection"] ?? null,
          count: jobs.length,
        }),
      })
      .run();

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
  const agentId = getAgentId();
  const { db } = await import("@clawops/core/db");
  const { updateOpenClawCronAction } = await import("@clawops/sync/openclaw");

  const result = await updateOpenClawCronAction(db, {
    actorAgentId: agentId,
    source: "cli",
    cronJobId: id,
    patch: { enabled },
    gatewayToken: getGatewayToken(opts),
  });

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

cronCmd
  .command("update <id>")
  .description("Update an OpenClaw cron job")
  .option("--name <value>", "Set the cron job name")
  .option("--schedule-kind <value>", "Set the schedule kind")
  .option("--schedule-expr <value>", "Set the schedule expression")
  .option("--session-target <value>", "Set the target session")
  .option("--enable", "Enable the cron job")
  .option("--disable", "Disable the cron job")
  .option("--gateway-token <token>", "Gateway token for the OpenClaw connection")
  .action(async (id: string, opts: Record<string, unknown>) => {
    const patch = {
      name: opts["name"] as string | undefined,
      scheduleKind: opts["scheduleKind"] as string | undefined,
      scheduleExpr: opts["scheduleExpr"] as string | undefined,
      sessionTarget: opts["sessionTarget"] as string | undefined,
      enabled:
        opts["enable"] === true
          ? true
          : opts["disable"] === true
            ? false
            : undefined,
    };

    if (Object.values(patch).every((value) => value === undefined)) {
      console.error("Provide at least one field to update.");
      process.exit(1);
    }

    const agentId = getAgentId();
    const { db } = await import("@clawops/core/db");
    const { updateOpenClawCronAction } = await import("@clawops/sync/openclaw");

    const result = await updateOpenClawCronAction(db, {
      actorAgentId: agentId,
      source: "cli",
      cronJobId: id,
      patch,
      gatewayToken: getGatewayToken(opts),
    });

    if (jsonOut(cronCmd)) {
      console.log(JSON.stringify(result.local, null, 2));
      return;
    }

    console.log(`cron job ${result.local.id} updated`);
  });
