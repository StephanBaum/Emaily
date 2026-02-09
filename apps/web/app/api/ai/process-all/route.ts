import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { processAllThreadsWithAI } from "@/lib/ai";

export async function POST() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teamId = session.user.teamId;

  const result = await processAllThreadsWithAI(teamId);

  return NextResponse.json({
    total: result.total,
    processed: result.processed,
    errors: result.errors,
    actions: result.results.flatMap((r) =>
      r.actionsExecuted.map((a) => ({
        action: a.action,
        tagName: a.tagName,
        detail: a.detail,
      }))
    ),
  });
}
