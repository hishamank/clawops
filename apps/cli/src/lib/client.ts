const baseUrl =
  process.env["CLAWOPS_API_URL"] ?? "http://localhost:3001";

function getApiKey(): string {
  const key = process.env["CLAWOPS_API_KEY"];
  if (!key) {
    console.error("CLAWOPS_API_KEY is required");
    process.exit(1);
  }
  return key;
}

async function request(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`API error ${res.status}: ${text}`);
    process.exit(1);
  }

  return res.json();
}

export const api = {
  get: (path: string) => request("GET", path),
  post: (path: string, body: unknown) => request("POST", path, body),
  patch: (path: string, body: unknown) => request("PATCH", path, body),
};
