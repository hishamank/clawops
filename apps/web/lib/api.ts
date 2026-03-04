import "server-only";

interface FetchOptions {
  method?: string;
  body?: unknown;
  tags?: string[];
  revalidate?: number;
}

export async function api<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const apiUrl = process.env.CLAWOPS_API_URL;
  const apiKey = process.env.CLAWOPS_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error("CLAWOPS_API_URL and CLAWOPS_API_KEY must be set");
  }

  const { method = "GET", body, tags, revalidate } = options;

  const headers: Record<string, string> = {
    "x-api-key": apiKey,
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${apiUrl}${path}`, {
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
