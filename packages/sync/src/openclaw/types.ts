export interface OpenClawAgentConfig {
  workspace?: string;
  default?: boolean;
  id?: string;
  name?: string;
  model?: string | { primary?: string; fallbacks?: string[] };
  models?: Record<string, { alias?: string; [key: string]: unknown }>;
  role?: string;
  framework?: string;
  avatar?: string;
  memoryPath?: string;
  skills?: string[] | string;
  channels?: Record<string, unknown>;
  identity?: {
    name?: string;
    avatar?: string;
    [key: string]: unknown;
  };
  llm?: {
    provider?: string;
    model?: string;
  };
  [key: string]: unknown;
}

export interface OpenClawConfig {
  agent?: OpenClawAgentConfig;
  agents?: {
    defaults?: OpenClawAgentConfig;
    list?: OpenClawAgentConfig[];
    [agentId: string]: OpenClawAgentConfig | OpenClawAgentConfig[] | undefined;
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
