import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const apiUrl = process.env.CLAWOPS_API_URL;
  const apiKey = process.env.CLAWOPS_API_KEY;

  if (!apiUrl || !apiKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: CLAWOPS_API_URL and CLAWOPS_API_KEY must be set" },
      { status: 500 }
    );
  }

  const { id } = await params;

  const res = await fetch(`${apiUrl}/ideas/${id}/promote`, {
    method: "POST",
    headers: { "x-api-key": apiKey },
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
