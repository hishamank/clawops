import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const agents = sqliteTable("agents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  status: text("status", { enum: ["online", "offline", "error"] })
    .notNull()
    .default("offline"),
  lastSeen: text("last_seen")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  metadata: text("metadata", { mode: "json" }).$type<
    Record<string, unknown>
  >(),
});

export const runs = sqliteTable("runs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id),
  task: text("task").notNull(),
  status: text("status", {
    enum: ["pending", "running", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  startedAt: text("started_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  finishedAt: text("finished_at"),
  output: text("output"),
  error: text("error"),
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
