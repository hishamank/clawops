/* eslint-disable no-console -- CLI tool uses console for output */

import { Command } from "commander";
import { getAgentId } from "../lib/client.js";
import type { Habit, HabitRun } from "@clawops/core";
import type { HabitType } from "@clawops/domain";

export const habitCmd = new Command("habit").description("Manage habits");

function jsonOut(cmd: Command): boolean {
  return Boolean(cmd.parent?.opts()["json"]);
}

habitCmd
  .command("register <name>")
  .description("Register a new habit")
  .requiredOption("--type <type>", "Habit type (cron|interval)")
  .option("--schedule <cron>", "Cron expression (required for cron type)")
  .option("--interval <ms>", "Interval in ms (required for interval type)")
  .action(async (name: string, opts: Record<string, string>) => {
    const habitType = opts["type"] as HabitType;

    if (habitType === "cron" && !opts["schedule"]) {
      console.error("--schedule is required for cron habits");
      process.exit(1);
    }
    if (habitType === "scheduled" && !opts["interval"]) {
      console.error("--interval is required for scheduled habits");
      process.exit(1);
    }

    const agentId = getAgentId();
    const { events } = await import("@clawops/core");
    const { db } = await import("@clawops/core/db");
    const { createHabit } = await import("@clawops/habits");

    const data: Habit = createHabit(db, agentId, {
      name,
      type: habitType,
      cronExpr: opts["schedule"],
      schedule: opts["interval"],
    });

    db.insert(events)
      .values({
        agentId,
        action: "habit.created",
        entityType: "habit",
        entityId: data.id,
        meta: JSON.stringify({ name, type: habitType }),
      })
      .run();

    if (jsonOut(habitCmd)) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`habit ${data.id} created`);
    }
  });

habitCmd
  .command("run <id>")
  .description("Log a habit run")
  .option("--note <note>", "Run note")
  .option("--success", "Mark as successful", false)
  .action(async (id: string, opts: Record<string, unknown>) => {
    const agentId = getAgentId();
    const success = Boolean(opts["success"]);
    const note = opts["note"] as string | undefined;

    const { events } = await import("@clawops/core");
    const { db } = await import("@clawops/core/db");
    const { logHabitRun } = await import("@clawops/habits");
    const data: HabitRun = logHabitRun(db, id, agentId, { success, note });

    db.insert(events)
      .values({
        agentId,
        action: "habit.run_logged",
        entityType: "habit_run",
        entityId: data.id,
        meta: JSON.stringify({ habitId: id, success, note }),
      })
      .run();

    if (jsonOut(habitCmd)) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`habit ${data.habitId} run logged`);
    }
  });

habitCmd
  .command("list")
  .description("List habits")
  .option("--agent <id>", "Filter by agent ID")
  .action(async (opts: Record<string, string>) => {
    const agentId = opts["agent"] ?? process.env["CLAWOPS_AGENT_ID"];

    const { events } = await import("@clawops/core");
    const { db } = await import("@clawops/core/db");
    const { listHabits } = await import("@clawops/habits");
    const data: Habit[] = listHabits(db, agentId);

    db.insert(events)
      .values({
        agentId: agentId ?? null,
        action: "habit.listed",
        entityType: "habit",
        entityId: "*",
        meta: JSON.stringify({ agentId: agentId ?? null }),
      })
      .run();

    if (jsonOut(habitCmd)) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      for (const h of data) {
        console.log(`habit ${h.id} ${h.name}`);
      }
    }
  });
