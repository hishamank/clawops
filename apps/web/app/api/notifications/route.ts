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
    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch notifications from upstream API" },
        { status: res.status },
      );
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      return NextResponse.json(
        { error: "Invalid response from upstream API: expected array" },
        { status: 500 },
      );
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch notifications from upstream API" },
      { status: 500 },
    );
  }
}
