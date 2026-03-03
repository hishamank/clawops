import { NextResponse } from "next/server";

const API_URL = process.env.CLAWOPS_API_URL ?? "http://localhost:3001";
const API_KEY = process.env.CLAWOPS_API_KEY ?? "";

export async function GET(): Promise<NextResponse> {
  try {
    const res = await fetch(`${API_URL}/notifications`, {
      headers: { "x-api-key": API_KEY },
    });
    if (!res.ok) return NextResponse.json([], { status: res.status });
    const data: unknown = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([]);
  }
}
