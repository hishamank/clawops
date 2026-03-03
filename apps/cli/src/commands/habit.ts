/* eslint-disable no-console -- CLI tool uses console for output */

import { Command } from "commander";
import { api, getAgentId, isLocalMode } from "../lib/client.js";
import type { Habit, HabitRun } from "@clawops/core";
import type { HabitType } from "@clawops/domain";

export const habitCmd = new Command("habit").description(
  "Manage habits",
);

// ── helpers ────────────────────────────────────────────────────────────────

function jsonOut(cmd: Command): boolean {
  return Boolean(cmd.parent?.opts()["json"]);
}

// ── habit register ──────────────────────────────────────────────────────────

habitCmd
  .command("register <name>")
  .description("Register a new habit")
  .requiredOption("--type <type>", "Habit type")
  .requiredOption("--schedule <cron>", "Cron expression")
  .option("--interval <ms>", "Interval in ms")
  .action(async (name: string, opts: Record<string, string>) => {
    const agentId = getAgentId();
    let data: Habit;

    if (isLocalMode()) {
      const { db } = await import("@clawops/core");
      const { createHabit } = await import("@clawops/habits");
      data = createHabit(db, agentId, {
        name,
        type: opts["type"] as HabitType,
        cronExpr: opts["schedule"],
        schedule: opts["interval"],
      });
    } else {
      const body: Record<string, unknown> = {
        name,
        type: opts["type"],
        cronExpr: opts["schedule"],
      };
      if (opts["interval"]) {
        body["schedule"] = opts["interval"];
      }
      data = (await api.post("/habits", body)) as Habit;
    }

    if (jsonOut(habitCmd)) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`habit ${data.id} created`);
    }
  });

// ── habit run ───────────────────────────────────────────────────────────────

habitCmd
  .command("run <id>")
  .description("Log a habit run")
  .option("--note <note>", "Run note")
  .option("--success", "Mark as successful", false)
  .action(async (id: string, opts: Record<string, unknown>) => {
    const agentId = getAgentId();
    const success = Boolean(opts["success"]);
    const note = opts["note"] as string | undefined;
    let data: HabitRun;

    if (isLocalMode()) {
      const { db } = await import("@clawops/core");
      const { logHabitRun } = await import("@clawops/habits");
      data = logHabitRun(db, id, agentId, { success, note });
    } else {
      const body: Record<string, unknown> = { success };
      if (note) {
        body["note"] = note;
      }
      data = (await api.post(`/habits/${id}/run`, body)) as HabitRun;
    }

    if (jsonOut(habitCmd)) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`habit ${data.habitId} run logged`);
    }
  });

// ── habit list ──────────────────────────────────────────────────────────────

habitCmd
  .command("list")
  .description("List habits")
  .option("--agent <id>", "Filter by agent ID")
  .action(async (opts: Record<string, string>) => {
    let data: Habit[];

    if (isLocalMode()) {
      const { db, events } = await import("@clawops/core");
      const { listHabits } = await import("@clawops/habits");
      const agentId = opts["agent"];
      data = listHabits(db, agentId);

      // Write read event in local mode
      db.insert(events)
        .values({
          agentId: agentId ?? null,
          action: "read",
          entityType: "habit",
          entityId: "*",
        })
        .run();
    } else {
      const query = opts["agent"] ? `?agentId=${opts["agent"]}` : "";
      data = (await api.get(`/habits${query}`)) as Habit[];
    }

    if (jsonOut(habitCmd)) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      for (const h of data) {
        console.log(`habit ${h.id} ${h.name}`);
      }
    }
  });
