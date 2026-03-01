const API_URL = process.env.CLAWOPS_API_URL ?? "http://localhost:3001";

interface ApiError {
  error: string;
}

export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({
      error: `HTTP ${res.status}`,
    }))) as ApiError;
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export interface Agent {
  id: string;
  name: string;
  status: string;
  lastSeen: string;
  metadata: Record<string, unknown> | null;
}

export interface Run {
  id: string;
  agentId: string;
  task: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  output: string | null;
  error: string | null;
}

export async function registerAgent(name: string): Promise<Agent> {
  return request<Agent>("/api/agents", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateAgentStatus(
  id: string,
  status: string,
): Promise<Agent> {
  return request<Agent>(`/api/agents/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function startRun(agentId: string, task: string): Promise<Run> {
  return request<Run>("/api/runs", {
    method: "POST",
    body: JSON.stringify({ agentId, task }),
  });
}

export async function finishRun(
  id: string,
  output: string,
  error?: string,
): Promise<Run> {
  return request<Run>(`/api/runs/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: error ? "failed" : "completed",
      output,
      ...(error && { error }),
    }),
  });
}

export async function listRuns(params?: {
  agent?: string;
  status?: string;
}): Promise<Run[]> {
  const search = new URLSearchParams();
  if (params?.agent) search.set("agent", params.agent);
  if (params?.status) search.set("status", params.status);
  const qs = search.toString();
  return request<Run[]>(`/api/runs${qs ? `?${qs}` : ""}`);
}
