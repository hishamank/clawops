import { eq, and, gte, desc } from "drizzle-orm";
import type { DB } from "@clawops/core";
import { habits, habitRuns } from "@clawops/core";
import type { Habit, HabitRun } from "@clawops/core";
import crypto from "node:crypto";

// ── createHabit ────────────────────────────────────────────────────────────

interface CreateHabitInput {
  name: string;
  type: "heartbeat" | "scheduled" | "cron" | "hook" | "watchdog" | "polling";
  schedule?: string;
  cronExpr?: string;
  trigger?: string;
  status?: "active" | "paused";
}

export function createHabit(
  db: DB,
  agentId: string,
  input: CreateHabitInput,
): Habit {
  const [habit] = db
    .insert(habits)
    .values({
      id: crypto.randomUUID(),
      agentId,
      name: input.name,
      type: input.type,
      schedule: input.schedule ?? null,
      cronExpr: input.cronExpr ?? null,
      trigger: input.trigger ?? null,
      status: input.status ?? "active",
    })
    .returning()
    .all();
  return habit;
}

// ── listHabits ─────────────────────────────────────────────────────────────

export function listHabits(db: DB, agentId?: string): Habit[] {
  if (agentId) {
    return db.select().from(habits).where(eq(habits.agentId, agentId)).all();
  }
  return db.select().from(habits).all();
}

// ── updateHabit ────────────────────────────────────────────────────────────

interface UpdateHabitInput {
  name?: string;
  schedule?: string;
  cronExpr?: string;
  status?: "active" | "paused";
  nextRun?: Date;
}

export function updateHabit(
  db: DB,
  id: string,
  updates: UpdateHabitInput,
): Habit {
  const [habit] = db
    .update(habits)
    .set(updates)
    .where(eq(habits.id, id))
    .returning()
    .all();
  return habit;
}

// ── logHabitRun ────────────────────────────────────────────────────────────

interface LogHabitRunInput {
  success: boolean;
  note?: string;
}

export function logHabitRun(
  db: DB,
  habitId: string,
  agentId: string,
  input: LogHabitRunInput,
): HabitRun {
  const now = new Date();

  const [run] = db
    .insert(habitRuns)
    .values({
      id: crypto.randomUUID(),
      habitId,
      agentId,
      ranAt: now,
      success: input.success,
      note: input.note ?? null,
    })
    .returning()
    .all();

  db.update(habits)
    .set({ lastRun: now })
    .where(eq(habits.id, habitId))
    .run();

  return run;
}

// ── getHabitStreak ─────────────────────────────────────────────────────────

interface StreakEntry {
  date: string;
  ran: boolean;
  success: boolean;
}

export function getHabitStreak(
  db: DB,
  habitId: string,
  days: number = 7,
): StreakEntry[] {
  const now = new Date();
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const cutoff = new Date(
    startOfToday.getTime() - (days - 1) * 24 * 60 * 60 * 1000,
  );

  const runs = db
    .select()
    .from(habitRuns)
    .where(
      and(eq(habitRuns.habitId, habitId), gte(habitRuns.ranAt, cutoff)),
    )
    .orderBy(desc(habitRuns.ranAt))
    .all();

  // Group runs by date
  const runsByDate = new Map<string, { ran: boolean; success: boolean }>();
  for (const run of runs) {
    const d = run.ranAt;
    const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const existing = runsByDate.get(dateStr);
    if (!existing) {
      runsByDate.set(dateStr, { ran: true, success: run.success });
    } else if (run.success) {
      existing.success = true;
    }
  }

  // Build streak array, newest first
  const result: StreakEntry[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startOfToday.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const entry = runsByDate.get(dateStr);
    result.push({
      date: dateStr,
      ran: entry?.ran ?? false,
      success: entry?.success ?? false,
    });
  }

  return result;
}

// ── logHeartbeat ───────────────────────────────────────────────────────────

export function logHeartbeat(db: DB, agentId: string): HabitRun {
  // Find existing heartbeat habit for this agent
  let habit = db
    .select()
    .from(habits)
    .where(
      and(
        eq(habits.agentId, agentId),
        eq(habits.type, "heartbeat"),
        eq(habits.name, "heartbeat"),
      ),
    )
    .get();

  // Auto-create if missing
  if (!habit) {
    habit = createHabit(db, agentId, {
      name: "heartbeat",
      type: "heartbeat",
    });
  }

  return logHabitRun(db, habit.id, agentId, { success: true });
}
