const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface Agent {
  id: string;
  name: string;
  status: "online" | "offline" | "error";
  lastSeen: string;
  metadata: Record<string, unknown> | null;
}

export interface Run {
  id: string;
  agentId: string;
  task: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string;
  finishedAt: string | null;
  output: string | null;
  error: string | null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Request failed: ${res.status}`,
    );
  }

  return res.json() as Promise<T>;
}

export async function getAgents(): Promise<Agent[]> {
  return request<Agent[]>("/api/agents");
}

export async function getAgent(id: string): Promise<Agent> {
  const agents = await request<Agent[]>("/api/agents");
  const agent = agents.find((a) => a.id === id);
  if (!agent) throw new Error("Agent not found");
  return agent;
}

export async function getAgentRuns(agentId: string): Promise<Run[]> {
  return request<Run[]>(`/api/agents/${agentId}/runs`);
}

export async function getRuns(params?: {
  agent?: string;
  status?: string;
}): Promise<Run[]> {
  const search = new URLSearchParams();
  if (params?.agent) search.set("agent", params.agent);
  if (params?.status) search.set("status", params.status);
  const qs = search.toString();
  return request<Run[]>(`/api/runs${qs ? `?${qs}` : ""}`);
}
