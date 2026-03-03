const API_URL = process.env.NEXT_PUBLIC_CLAWOPS_API_URL ?? "http://localhost:3001";
const API_KEY = process.env.NEXT_PUBLIC_CLAWOPS_API_KEY ?? "";

interface FetchOptions {
  method?: string;
  body?: unknown;
  tags?: string[];
  revalidate?: number;
}

export async function api<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { method = "GET", body, tags, revalidate } = options;

  const headers: Record<string, string> = {
    "x-api-key": API_KEY,
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    next: {
      tags,
      revalidate: revalidate ?? 30,
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}
