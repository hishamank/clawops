import { type NextRequest, NextResponse } from "next/server";

const API_URL = process.env.CLAWOPS_API_URL ?? "http://localhost:3001";
const API_KEY = process.env.CLAWOPS_API_KEY ?? "";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  try {
    const res = await fetch(`${API_URL}/notifications/${id}`, {
      method: "PATCH",
      headers: {
        "x-api-key": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ read: true }),
    });
    if (!res.ok) return NextResponse.json({ error: "Failed" }, { status: res.status });
    const data: unknown = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
