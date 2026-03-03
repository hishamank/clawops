export interface Agent {
  id: string;
  name: string;
  model: string;
  role: string;
  status: "online" | "idle" | "busy" | "offline";
  lastActive: string | null;
  avatar: string | null;
  framework: string | null;
  memoryPath: string | null;
  skills: string | null;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "backlog" | "todo" | "in-progress" | "review" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  assigneeId: string | null;
  projectId: string | null;
  source: "human" | "agent" | "cli" | "script";
  dueDate: string | null;
  completedAt: string | null;
  summary: string | null;
  createdAt: string;
}

export interface Habit {
  id: string;
  agentId: string;
  name: string;
  type: "heartbeat" | "scheduled" | "cron" | "hook" | "watchdog" | "polling";
  schedule: string | null;
  cronExpr: string | null;
  trigger: string | null;
  status: "active" | "paused";
  lastRun: string | null;
  nextRun: string | null;
  createdAt: string;
}

export interface HabitStreak {
  date: string;
  ran: boolean;
  success: boolean;
}

export interface Idea {
  id: string;
  title: string;
  description: string | null;
  status: "raw" | "reviewed" | "promoted" | "archived";
  tags: string | null;
  projectId: string | null;
  source: "human" | "agent";
  createdAt: string;
}

export interface TokenSummary {
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  createdAt: string;
}

export interface Artifact {
  id: string;
  taskId: string;
  label: string;
  value: string;
  createdAt: string;
}

export interface AgentDetail extends Agent {
  recentTasks?: Task[];
  habits?: Habit[];
  streaks?: Record<string, HabitStreak[]>;
}
