import { NextResponse } from "next/server";

const API_URL = process.env.CLAWOPS_API_URL ?? "http://localhost:3001";
const API_KEY = process.env.CLAWOPS_API_KEY ?? "";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { id } = params;

  const res = await fetch(`${API_URL}/ideas/${id}/promote`, {
    method: "POST",
    headers: { "x-api-key": API_KEY },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to promote idea" },
      { status: res.status }
    );
  }

  const data: unknown = await res.json();
  return NextResponse.json(data);
}
