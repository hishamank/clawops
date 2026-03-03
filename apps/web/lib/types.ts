import type {
  AgentStatus,
  TaskStatus,
  TaskPriority,
  ProjectStatus,
  MilestoneStatus,
  HabitType,
  HabitStatus,
  IdeaStatus,
  Source,
} from "@clawops/domain";

export interface Agent {
  id: string;
  name: string;
  model: string;
  role: string;
  status: AgentStatus;
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
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  projectId: string | null;
  source: Source;
  dueDate: string | null;
  completedAt: string | null;
  summary: string | null;
  createdAt: string;
}

export interface Habit {
  id: string;
  agentId: string;
  name: string;
  type: HabitType;
  schedule: string | null;
  cronExpr: string | null;
  trigger: string | null;
  status: HabitStatus;
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
  status: IdeaStatus;
  tags: string | null;
  projectId: string | null;
  source: Source;
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

export interface Milestone {
  id: string;
  title: string;
  status: MilestoneStatus;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  ideaId: string | null;
  prd: string | null;
  prdUpdatedAt: string | null;
  milestones: Milestone[];
  taskCount: number;
  createdAt: string;
}

export interface ProjectDetail extends Project {
  completedTaskCount?: number;
  tasks?: Task[];
}

export interface AgentDetail extends Agent {
  recentTasks?: Task[];
  habits?: Habit[];
  streaks?: Record<string, HabitStreak[]>;
}
