import { eq, and, gte, desc } from "drizzle-orm";
import type { DB } from "@clawops/core";
import { habits, habitRuns } from "@clawops/core";
import type { Habit, HabitRun } from "@clawops/core";
import { HabitType, HabitStatus } from "@clawops/domain";
import type { HabitType as HabitTypeT, HabitStatus as HabitStatusT } from "@clawops/domain";
import crypto from "node:crypto";

// ── createHabit ────────────────────────────────────────────────────────────

interface CreateHabitInput {
  name: string;
  type: HabitTypeT;
  schedule?: string;
  cronExpr?: string;
  trigger?: string;
  status?: HabitStatusT;
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
      status: input.status ?? HabitStatus.active,
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
  schedule?: string | null;
  cronExpr?: string | null;
  status?: HabitStatusT;
  nextRun?: Date | null;
}

export function updateHabit(
  db: DB,
  id: string,
  updates: UpdateHabitInput,
): Habit {
  const rows = db
    .update(habits)
    .set(updates)
    .where(eq(habits.id, id))
    .returning()
    .all();

  if (rows.length === 0) {
    throw new Error(`Habit with id "${id}" not found`);
  }

  return rows[0];
}

// ── logHabitRun ────────────────────────────────────────────────────────────

interface LogHabitRunInput {
  success: boolean;
  note?: string;
  ranAt?: Date;
}

export function logHabitRun(
  db: DB,
  habitId: string,
  agentId: string,
  input: LogHabitRunInput,
): HabitRun {
  return db.transaction((tx) => {
    // Verify the habit exists and belongs to this agent
    const habit = tx
      .select()
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.agentId, agentId)))
      .get();

    if (!habit) {
      throw new Error(
        `Habit "${habitId}" not found or does not belong to agent "${agentId}"`,
      );
    }

    const now = input.ranAt ?? new Date();

    const [run] = tx
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

    tx.update(habits)
      .set({ lastRun: now })
      .where(eq(habits.id, habitId))
      .run();

    return run;
  });
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
  return db.transaction((tx) => {
    // Find existing heartbeat habit for this agent
    let habit = tx
      .select()
      .from(habits)
      .where(
        and(
          eq(habits.agentId, agentId),
          eq(habits.type, HabitType.heartbeat),
          eq(habits.name, "heartbeat"),
        ),
      )
      .get();

    // Auto-create if missing (atomic within this transaction)
    if (!habit) {
      const [created] = tx
        .insert(habits)
        .values({
          id: crypto.randomUUID(),
          agentId,
          name: "heartbeat",
          type: HabitType.heartbeat,
          schedule: null,
          cronExpr: null,
          trigger: null,
          status: HabitStatus.active,
        })
        .returning()
        .all();
      habit = created;
    }

    const now = input.ranAt ?? new Date();

    const [run] = tx
      .insert(habitRuns)
      .values({
        id: crypto.randomUUID(),
        habitId: habit.id,
        agentId,
        ranAt: now,
        success: true,
        note: null,
      })
      .returning()
      .all();

    tx.update(habits)
      .set({ lastRun: now })
      .where(eq(habits.id, habit.id))
      .run();

    return run;
  });
}

export * from "./openclaw.js";
