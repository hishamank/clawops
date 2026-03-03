import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  const apiUrl = process.env.CLAWOPS_API_URL;
  const apiKey = process.env.CLAWOPS_API_KEY;

  if (!apiUrl || !apiKey) {
    return NextResponse.json(
      { error: "CLAWOPS_API_URL and CLAWOPS_API_KEY must be set" },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(`${apiUrl}/notifications`, {
      headers: { "x-api-key": apiKey },
    });
    if (!res.ok) return NextResponse.json([], { status: res.status });
    const data: unknown = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to reach API" },
      { status: 500 },
    );
  }
}
