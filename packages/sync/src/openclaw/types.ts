export interface OpenClawConfig {
  agent?: {
    workspace?: string;
  };
  agents?: {
    defaults?: {
      workspace?: string;
    };
    [agentId: string]: {
      workspace?: string;
      channels?: Record<string, unknown>;
    } | undefined;
  };
  gateway?: {
    port?: number;
    host?: string;
  };
}

export interface OpenClawScanOptions {
  openclawDir?: string;       // default: ~/.openclaw
  gatewayUrl?: string;        // default: http://localhost:3000
  gatewayToken?: string;      // optional, for live gateway sync
  includeFiles?: boolean;     // default: true — read workspace files
}

export interface OpenClawGatewayAgent {
  sessionKey: string;
  agentId: string;
  channel: string;
  model?: string;
}
