export interface SyncAgent {
  id: string;
  name: string;
  workspacePath: string;
  channels: string[];
  sessionKey?: string;
  model?: string;
  modelAlias?: string;
  role?: string;
  framework?: string;
  avatar?: string;
  skills?: string[];
  memoryPath?: string;
}

export interface SyncCronJob {
  id: string;
  name: string;
  schedule: unknown;
  enabled: boolean;
  lastRunAt?: string;
  model?: string;
}

export interface SyncWorkspace {
  agentId: string;
  path: string;
  files: {
    soul?: string;
    agents?: string;
    tools?: string;
    identity?: string;
    sessionState?: string;
  };
}

export interface SyncResult {
  provider: string;
  syncedAt: string;
  agents: SyncAgent[];
  cronJobs: SyncCronJob[];
  workspaces: SyncWorkspace[];
}

export interface SyncOptions {
  dryRun?: boolean;
}
