export const AgentStatus = {
  online: "online",
  idle: "idle",
  busy: "busy",
  offline: "offline",
} as const;

export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus];

export const TaskStatus = {
  backlog: "backlog",
  todo: "todo",
  "in-progress": "in-progress",
  review: "review",
  done: "done",
  cancelled: "cancelled",
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskPriority = {
  low: "low",
  medium: "medium",
  high: "high",
  urgent: "urgent",
} as const;

export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export const ProjectStatus = {
  planning: "planning",
  active: "active",
  paused: "paused",
  done: "done",
} as const;

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const MilestoneStatus = {
  pending: "pending",
  done: "done",
} as const;

export type MilestoneStatus =
  (typeof MilestoneStatus)[keyof typeof MilestoneStatus];

export const HabitType = {
  heartbeat: "heartbeat",
  scheduled: "scheduled",
  cron: "cron",
  hook: "hook",
  watchdog: "watchdog",
  polling: "polling",
} as const;

export type HabitType = (typeof HabitType)[keyof typeof HabitType];

export const HabitStatus = {
  active: "active",
  paused: "paused",
} as const;

export type HabitStatus = (typeof HabitStatus)[keyof typeof HabitStatus];

export const IdeaStatus = {
  raw: "raw",
  reviewed: "reviewed",
  promoted: "promoted",
  archived: "archived",
} as const;

export type IdeaStatus = (typeof IdeaStatus)[keyof typeof IdeaStatus];

export const Source = {
  human: "human",
  agent: "agent",
  cli: "cli",
  script: "script",
} as const;

export type Source = (typeof Source)[keyof typeof Source];
