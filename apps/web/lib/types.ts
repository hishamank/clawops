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
import type { ActivityEventSeverity, ActivityEventSource } from "@clawops/core";

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
  specContent: string | null;
  specUpdatedAt: string | null;
  templateId: string | null;
  stageId: string | null;
  properties: string | null;
  ideaId: string | null;
  createdAt: string;
}

export interface TaskRelationWithTask {
  relation: {
    id: string;
    fromTaskId: string;
    toTaskId: string;
    type: "blocks" | "depends-on" | "related-to";
    createdAt: string;
  };
  task: Task;
  direction: "outgoing" | "incoming";
}

export interface ResourceLink {
  id: string;
  entityType: string;
  entityId: string;
  provider: string;
  resourceType: string;
  label: string | null;
  url: string;
  externalId: string | null;
  meta: string | null;
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

export interface ProjectListItem {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  ideaId: string | null;
  prd: string | null;
  prdUpdatedAt: string | null;
  specContent: string | null;
  specUpdatedAt: string | null;
  createdAt: string;
}

export interface ProjectDetail extends ProjectListItem {
  milestones: Milestone[];
  taskCount: number;
  completedTaskCount?: number;
  tasks?: Task[];
}

export interface OpenClawSession {
  id: string;
  connectionId: string;
  sessionKey: string;
  agentId: string | null;
  model: string | null;
  status: "active" | "ended";
  startedAt: string;
  endedAt: string | null;
  metadata: string | null;
  createdAt: string;
}

export interface AgentMessage {
  id: string;
  connectionId: string;
  fromAgentId: string | null;
  toAgentId: string | null;
  sessionId: string | null;
  channel: string | null;
  messageType: string | null;
  summary: string | null;
  content: string | null;
  sentAt: string;
  createdAt: string;
}

export interface OpenClawMapping {
  id: string;
  connectionId: string;
  linkedAgentId: string;
  externalAgentId: string;
  externalAgentName: string;
  workspacePath: string | null;
  memoryPath: string | null;
  defaultModel: string | null;
  lastSeenAt: string | null;
}

export interface AgentDetail extends Agent {
  recentTasks?: Task[];
  habits?: Habit[];
  streaks?: Record<string, HabitStreak[]>;
  sessions?: OpenClawSession[];
  cronJobs?: Habit[];
  messages?: AgentMessage[];
  activity?: ActivityEvent[];
  openclawMapping?: OpenClawMapping | null;
}

export interface ActivityEvent {
  id: string;
  source: ActivityEventSource;
  severity: ActivityEventSeverity;
  type: string;
  title: string;
  body: string | null;
  agentId: string | null;
  entityType: string | null;
  entityId: string | null;
  projectId: string | null;
  taskId: string | null;
  metadata: string | null;
  createdAt: string;
}
