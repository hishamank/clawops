import type { SyncAgent, SyncCronJob } from "../types.js";

export async function fetchGatewayAgents(
  gatewayUrl: string,
  token: string
): Promise<SyncAgent[]> {
  try {
    const res = await fetch(`${gatewayUrl}/api/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json() as unknown;
    // Normalize response — gateway may return different shapes
    const sessions = Array.isArray(data) ? data : (data as Record<string, unknown[]>).sessions ?? [];
    return (sessions as Record<string, unknown>[]).map((s) => ({
      id: String(s["agentId"] ?? s["id"] ?? "unknown"),
      name: String(s["agentId"] ?? s["name"] ?? "unknown"),
      workspacePath: "",
      channels: [String(s["sessionKey"] ?? "")],
      sessionKey: String(s["sessionKey"] ?? ""),
    }));
  } catch {
    return [];
  }
}

export async function fetchGatewayCronJobs(
  gatewayUrl: string,
  token: string
): Promise<SyncCronJob[]> {
  try {
    const res = await fetch(`${gatewayUrl}/api/cron`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json() as unknown;
    const jobs = Array.isArray(data) ? data : (data as Record<string, unknown[]>).jobs ?? [];
    return (jobs as Record<string, unknown>[]).map((j) => ({
      id: String(j["id"] ?? ""),
      name: String(j["name"] ?? ""),
      schedule: j["schedule"] ?? null,
      enabled: Boolean(j["enabled"] ?? true),
      lastRunAt: j["state"] ? String((j["state"] as Record<string, unknown>)["lastRunAtMs"] ?? "") : undefined,
      model: j["payload"] ? String((j["payload"] as Record<string, unknown>)["model"] ?? "") : undefined,
    }));
  } catch {
    return [];
  }
}
