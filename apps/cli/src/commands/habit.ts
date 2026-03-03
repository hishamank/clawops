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
  .requiredOption("--type <type>", "Habit type (cron|interval)")
  .option("--schedule <cron>", "Cron expression (required for cron type)")
  .option("--interval <ms>", "Interval in ms (required for interval type)")
  .action(async (name: string, opts: Record<string, string>) => {
    const habitType = opts["type"] as HabitType;

    // Validate schedule/interval based on type
    if (habitType === "cron" && !opts["schedule"]) {
      console.error("--schedule is required for cron habits");
      process.exit(1);
    }
    if (habitType === "scheduled" && !opts["interval"]) {
      console.error("--interval is required for scheduled habits");
      process.exit(1);
    }

    const agentId = getAgentId();
    let data: Habit;

    if (isLocalMode()) {
      const { db, events } = await import("@clawops/core");
      const { createHabit } = await import("@clawops/habits");
      data = createHabit(db, agentId, {
        name,
        type: habitType,
        cronExpr: opts["schedule"],
        schedule: opts["interval"],
      });

      // Write habit.created event
      db.insert(events)
        .values({
          agentId,
          action: "habit.created",
          entityType: "habit",
          entityId: data.id,
          meta: JSON.stringify({ name, type: habitType }),
        })
        .run();
    } else {
      const body: Record<string, unknown> = {
        name,
        type: opts["type"],
      };
      if (opts["schedule"]) {
        body["cronExpr"] = opts["schedule"];
      }
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
      const { db, events } = await import("@clawops/core");
      const { logHabitRun } = await import("@clawops/habits");
      data = logHabitRun(db, id, agentId, { success, note });

      // Write habit.run_logged event
      db.insert(events)
        .values({
          agentId,
          action: "habit.run_logged",
          entityType: "habit_run",
          entityId: data.id,
          meta: JSON.stringify({ habitId: id, success, note }),
        })
        .run();
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
    // Default to CLAWOPS_AGENT_ID when --agent is not provided
    const agentId = opts["agent"] ?? process.env["CLAWOPS_AGENT_ID"];
    let data: Habit[];

    if (isLocalMode()) {
      const { db, events } = await import("@clawops/core");
      const { listHabits } = await import("@clawops/habits");
      data = listHabits(db, agentId);

      // Write habit.listed event
      db.insert(events)
        .values({
          agentId: agentId ?? null,
          action: "habit.listed",
          entityType: "habit",
          entityId: "*",
          meta: JSON.stringify({ agentId: agentId ?? null }),
        })
        .run();
    } else {
      const params = new URLSearchParams();
      if (agentId) params.set("agentId", agentId);
      const qs = params.toString();
      data = (await api.get(`/habits${qs ? `?${qs}` : ""}`)) as Habit[];
    }

    if (jsonOut(habitCmd)) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      for (const h of data) {
        console.log(`habit ${h.id} ${h.name}`);
      }
    }
  });
