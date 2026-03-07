export const dynamic = "force-dynamic";

import { openclaw } from "@clawops/sync";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = z.object({ workspacePaths: z.array(z.string().min(1)) }).parse(await req.json());
    const safePaths = body.workspacePaths.filter((p) => !p.includes(".."));
    if (safePaths.length !== body.workspacePaths.length) {
      return NextResponse.json(
        { error: "Invalid workspace path: path traversal not allowed" },
        { status: 400 },
      );
    }

    const results = safePaths.map((workspacePath) => ({
      workspacePath,
      ...openclaw.installClawOpsSkill(workspacePath),
    }));

    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
