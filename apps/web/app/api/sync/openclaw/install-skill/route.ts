import { api } from "@/lib/api";
import { NextResponse } from "next/server";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json() as unknown;
    const result = await api<unknown>("/sync/openclaw/install-skill", { method: "POST", body });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Install failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
