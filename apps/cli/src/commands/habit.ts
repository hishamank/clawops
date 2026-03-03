/* eslint-disable no-console -- CLI tool uses console for output */

import { Command } from "commander";
import { api } from "../lib/client.js";

interface HabitResult {
  id: string;
  name?: string;
  [key: string]: unknown;
}

export const habitCmd = new Command("habit").description(
  "Manage habits",
);

// ── habit register ──────────────────────────────────────────────────────────

habitCmd
  .command("register <name>")
  .description("Register a new habit")
  .requiredOption("--type <type>", "Habit type")
  .requiredOption("--schedule <cron>", "Cron expression")
  .option("--interval <ms>", "Interval in ms")
  .action(async (name: string, opts: Record<string, string>) => {
    const body: Record<string, unknown> = {
      name,
      type: opts["type"],
      cronExpr: opts["schedule"],
    };
    if (opts["interval"]) {
      body["schedule"] = opts["interval"];
    }
    const data = (await api.post("/habits", body)) as HabitResult;
    if (habitCmd.parent?.opts()["json"]) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`habit ${data["id"]} created`);
    }
  });

// ── habit run ───────────────────────────────────────────────────────────────

habitCmd
  .command("run <id>")
  .description("Log a habit run")
  .option("--note <note>", "Run note")
  .option("--success", "Mark as successful", false)
  .action(async (id: string, opts: Record<string, unknown>) => {
    const body: Record<string, unknown> = {
      success: Boolean(opts["success"]),
    };
    if (opts["note"]) {
      body["note"] = opts["note"];
    }
    const data = (await api.post(`/habits/${id}/run`, body)) as HabitResult;
    if (habitCmd.parent?.opts()["json"]) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`habit ${data["id"]} run logged`);
    }
  });

// ── habit list ──────────────────────────────────────────────────────────────

habitCmd
  .command("list")
  .description("List habits")
  .option("--agent <id>", "Filter by agent ID")
  .action(async (opts: Record<string, string>) => {
    const query = opts["agent"] ? `?agentId=${opts["agent"]}` : "";
    const data = (await api.get(`/habits${query}`)) as HabitResult[];
    if (habitCmd.parent?.opts()["json"]) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      for (const h of data) {
        console.log(`habit ${h["id"]} ${h["name"]}`);
      }
    }
  });
