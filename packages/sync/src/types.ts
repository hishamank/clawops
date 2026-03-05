export interface SyncAgent {
  id: string;
  name: string;
  workspacePath: string;
  channels: string[];
  sessionKey?: string;
}

export interface SyncCronJob {
  id: string;
  name: string;
  schedule: string;
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
