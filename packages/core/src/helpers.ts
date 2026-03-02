export function parseJsonArray(val: string | null): string[] {
  if (!val) return [];
  try {
    const parsed: unknown = JSON.parse(val);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
    return [];
  } catch {
    return [];
  }
}

export function toJsonArray(arr: string[]): string {
  return JSON.stringify(arr);
}

export function parseJsonObject(val: string | null): Record<string, unknown> {
  if (!val) return {};
  try {
    const parsed: unknown = JSON.parse(val);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

export function toJsonObject(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}
