import "server-only";

export interface SyncStatus {
  syncedAt: string;
  agentCount: number;
  cronJobCount: number;
  agents: Array<{ id: string; name: string; workspacePath: string }>;
}

let lastSyncResult: SyncStatus | null = null;

export function setLastSyncResult(result: SyncStatus): void {
  lastSyncResult = result;
}

export function getLastSyncResult(): SyncStatus | null {
  return lastSyncResult;
}
