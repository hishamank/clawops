import { type NextRequest, NextResponse } from "next/server";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const apiUrl = process.env.CLAWOPS_API_URL;
  const apiKey = process.env.CLAWOPS_API_KEY;

  if (!apiUrl || !apiKey) {
    return NextResponse.json(
      { error: "CLAWOPS_API_URL and CLAWOPS_API_KEY must be set" },
      { status: 500 },
    );
  }

  const { id } = params;
  try {
    const res = await fetch(`${apiUrl}/notifications/${id}`, {
      method: "PATCH",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ read: true }),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to mark notification as read" },
        { status: res.status },
      );
    }
    const data: unknown = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to mark notification as read" },
      { status: 500 },
    );
  }
}
