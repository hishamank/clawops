import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import crypto from "node:crypto";

// ── Agents ──────────────────────────────────────────────────────────────────

export const agents = sqliteTable("agents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  model: text("model").notNull(),
  role: text("role").notNull(),
  status: text("status", {
    enum: ["online", "idle", "busy", "offline"],
  })
    .notNull()
    .default("offline"),
  lastActive: integer("last_active", { mode: "timestamp" }),
  avatar: text("avatar"),
  framework: text("framework"),
  apiKey: text("api_key").unique(),
  memoryPath: text("memory_path"),
  skills: text("skills"), // JSON array string
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── OpenClaw Connections ────────────────────────────────────────────────────

export const openclawConnections = sqliteTable("openclaw_connections", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  provider: text("provider", {
    enum: ["openclaw"],
  })
    .notNull()
    .default("openclaw"),
  name: text("name").notNull(),
  rootPath: text("root_path").notNull().unique(),
  gatewayUrl: text("gateway_url"),
  status: text("status", {
    enum: ["active", "disconnected", "error"],
  })
    .notNull()
    .default("disconnected"),
  syncMode: text("sync_mode", {
    enum: ["manual", "hybrid"],
  })
    .notNull()
    .default("manual"),
  hasGatewayToken: integer("has_gateway_token", { mode: "boolean" })
    .notNull()
    .default(false),
  meta: text("meta"),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const openclawAgents = sqliteTable(
  "openclaw_agents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectionId: text("connection_id")
      .notNull()
      .references(() => openclawConnections.id),
    linkedAgentId: text("linked_agent_id")
      .notNull()
      .references(() => agents.id),
    externalAgentId: text("external_agent_id").notNull(),
    externalAgentName: text("external_agent_name").notNull(),
    workspacePath: text("workspace_path"),
    memoryPath: text("memory_path"),
    defaultModel: text("default_model"),
    role: text("role"),
    avatar: text("avatar"),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    connectionExternalIdentityUnique: uniqueIndex(
      "openclaw_agents_connection_external_identity_unique",
    ).on(table.connectionId, table.externalAgentId),
  }),
);

export const workspaceFiles = sqliteTable(
  "workspace_files",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectionId: text("connection_id")
      .notNull()
      .references(() => openclawConnections.id, { onDelete: "cascade" }),
    workspacePath: text("workspace_path").notNull(),
    relativePath: text("relative_path").notNull(),
    fileHash: text("file_hash"),
    sizeBytes: integer("size_bytes"),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    connectionRelativePathUnique: uniqueIndex(
      "workspace_files_connection_relative_path_unique",
    ).on(table.connectionId, table.relativePath),
  }),
);

// ── Projects ────────────────────────────────────────────────────────────────

export const projects = sqliteTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", {
    enum: ["planning", "active", "paused", "done"],
  })
    .notNull()
    .default("planning"),
  ideaId: text("idea_id"),
  prd: text("prd"),
  prdUpdatedAt: integer("prd_updated_at", { mode: "timestamp" }),
  specContent: text("spec_content"),
  specUpdatedAt: integer("spec_updated_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Milestones ──────────────────────────────────────────────────────────────

export const milestones = sqliteTable("milestones", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  title: text("title").notNull(),
  status: text("status", {
    enum: ["pending", "done"],
  })
    .notNull()
    .default("pending"),
  order: integer("order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Tasks ───────────────────────────────────────────────────────────────────

export const tasks = sqliteTable("tasks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", {
    enum: ["backlog", "todo", "in-progress", "review", "done", "cancelled"],
  })
    .notNull()
    .default("backlog"),
  priority: text("priority", {
    enum: ["low", "medium", "high", "urgent"],
  })
    .notNull()
    .default("medium"),
  assigneeId: text("assignee_id").references(() => agents.id),
  projectId: text("project_id").references(() => projects.id),
  source: text("source", {
    enum: ["human", "agent", "cli", "script"],
  })
    .notNull()
    .default("human"),
  dueDate: integer("due_date", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  summary: text("summary"),
  specContent: text("spec_content"),
  specUpdatedAt: integer("spec_updated_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Artifacts ───────────────────────────────────────────────────────────────

export const artifacts = sqliteTable("artifacts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id),
  label: text("label").notNull(),
  value: text("value").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Ideas ───────────────────────────────────────────────────────────────────

export const ideas = sqliteTable("ideas", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", {
    enum: ["raw", "reviewed", "promoted", "archived"],
  })
    .notNull()
    .default("raw"),
  tags: text("tags"), // JSON array string
  sections: text("sections"), // JSON object string for structured sections
  projectId: text("project_id"),
  source: text("source", {
    enum: ["human", "agent"],
  })
    .notNull()
    .default("human"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Habits ──────────────────────────────────────────────────────────────────

export const habits = sqliteTable("habits", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  connectionId: text("connection_id").references(() => openclawConnections.id),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id),
  externalId: text("external_id"),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["heartbeat", "scheduled", "cron", "hook", "watchdog", "polling"],
  }).notNull(),
  schedule: text("schedule"),
  cronExpr: text("cron_expr"),
  scheduleKind: text("schedule_kind"),
  scheduleExpr: text("schedule_expr"),
  trigger: text("trigger"),
  sessionTarget: text("session_target"),
  status: text("status", {
    enum: ["active", "paused"],
  })
    .notNull()
    .default("active"),
  enabled: integer("enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  lastRun: integer("last_run", { mode: "timestamp" }),
  nextRun: integer("next_run", { mode: "timestamp" }),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  connectionExternalIdentityUnique: uniqueIndex(
    "habits_connection_external_id_unique",
  ).on(table.connectionId, table.externalId),
}));

// ── Habit Runs ──────────────────────────────────────────────────────────────

export const habitRuns = sqliteTable("habit_runs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  habitId: text("habit_id")
    .notNull()
    .references(() => habits.id),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id),
  ranAt: integer("ran_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  success: integer("success", { mode: "boolean" }).notNull().default(true),
  note: text("note"),
});

// ── Usage Logs ──────────────────────────────────────────────────────────────

export const usageLogs = sqliteTable("usage_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id),
  taskId: text("task_id").references(() => tasks.id),
  model: text("model").notNull(),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  cost: real("cost").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Events ──────────────────────────────────────────────────────────────────

export const events = sqliteTable("events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agentId: text("agent_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  meta: text("meta"), // JSON object string
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Notifications ───────────────────────────────────────────────────────────

export const notifications = sqliteTable("notifications", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Activity Events ────────────────────────────────────────────────────────

export const activityEvents = sqliteTable("activity_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  source: text("source", {
    enum: ["system", "agent", "user", "sync", "workflow", "hook"],
  }).notNull(),
  severity: text("severity", {
    enum: ["info", "warning", "error", "critical"],
  })
    .notNull()
    .default("info"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  agentId: text("agent_id").references(() => agents.id),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  projectId: text("project_id").references(() => projects.id),
  taskId: text("task_id").references(() => tasks.id),
  metadata: text("metadata"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Agent Sessions ──────────────────────────────────────────────────────────

export const agentSessions = sqliteTable("agent_sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id),
  projectId: text("project_id").references(() => projects.id),
  status: text("status", {
    enum: ["active", "inactive"],
  })
    .notNull()
    .default("inactive"),
  lastSessionSummary: text("last_session_summary"),
  startedAt: integer("started_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  endedAt: integer("ended_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Sync Runs ───────────────────────────────────────────────────────────────

export const syncRuns = sqliteTable("sync_runs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  connectionId: text("connection_id"),
  syncType: text("sync_type", {
    enum: ["manual", "scheduled", "reconcile"],
  })
    .notNull()
    .default("manual"),
  status: text("status", {
    enum: ["running", "success", "failed"],
  })
    .notNull()
    .default("running"),
  startedAt: integer("started_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  agentCount: integer("agent_count").notNull().default(0),
  cronJobCount: integer("cron_job_count").notNull().default(0),
  workspaceCount: integer("workspace_count").notNull().default(0),
  addedCount: integer("added_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
  removedCount: integer("removed_count").notNull().default(0),
  error: text("error"),
  meta: text("meta"),
});

export const syncRunItems = sqliteTable("sync_run_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  syncRunId: text("sync_run_id")
    .notNull()
    .references(() => syncRuns.id),
  itemType: text("item_type", {
    enum: ["agent", "workspace", "cron_job"],
  }).notNull(),
  itemExternalId: text("item_external_id").notNull(),
  changeType: text("change_type", {
    enum: ["seen", "added", "updated", "removed", "failed"],
  }).notNull(),
  summary: text("summary"),
  meta: text("meta"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Task Templates ──────────────────────────────────────────────────────────

export const taskTemplates = sqliteTable("task_templates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  description: text("description"),
  isBuiltIn: integer("is_built_in", { mode: "boolean" })
    .notNull()
    .default(false),
  isCustom: integer("is_custom", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Task Template Stages ───────────────────────────────────────────────────

export const taskTemplateStages = sqliteTable("task_template_stages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  templateId: text("template_id")
    .notNull()
    .references(() => taskTemplates.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  order: integer("order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Inferred Types ──────────────────────────────────────────────────────────

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

export type OpenClawConnection = typeof openclawConnections.$inferSelect;
export type NewOpenClawConnection = typeof openclawConnections.$inferInsert;
export type OpenClawAgent = typeof openclawAgents.$inferSelect;
export type NewOpenClawAgent = typeof openclawAgents.$inferInsert;
export type WorkspaceFile = typeof workspaceFiles.$inferSelect;
export type NewWorkspaceFile = typeof workspaceFiles.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type Milestone = typeof milestones.$inferSelect;
export type NewMilestone = typeof milestones.$inferInsert;

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export type Artifact = typeof artifacts.$inferSelect;
export type NewArtifact = typeof artifacts.$inferInsert;

export type Idea = typeof ideas.$inferSelect;
export type NewIdea = typeof ideas.$inferInsert;

export type Habit = typeof habits.$inferSelect;
export type NewHabit = typeof habits.$inferInsert;

export type HabitRun = typeof habitRuns.$inferSelect;
export type NewHabitRun = typeof habitRuns.$inferInsert;

export type UsageLog = typeof usageLogs.$inferSelect;
export type NewUsageLog = typeof usageLogs.$inferInsert;

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type AgentSession = typeof agentSessions.$inferSelect;
export type NewAgentSession = typeof agentSessions.$inferInsert;

export type ActivityEvent = typeof activityEvents.$inferSelect;
export type NewActivityEvent = typeof activityEvents.$inferInsert;
export type ActivityEventSeverity = NonNullable<NewActivityEvent["severity"]>;
export type ActivityEventSource = NonNullable<NewActivityEvent["source"]>;
export type SyncRun = typeof syncRuns.$inferSelect;
export type NewSyncRun = typeof syncRuns.$inferInsert;

export type SyncRunItem = typeof syncRunItems.$inferSelect;
export type NewSyncRunItem = typeof syncRunItems.$inferInsert;

export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type NewTaskTemplate = typeof taskTemplates.$inferInsert;

export type TaskTemplateStage = typeof taskTemplateStages.$inferSelect;
export type NewTaskTemplateStage = typeof taskTemplateStages.$inferInsert;
