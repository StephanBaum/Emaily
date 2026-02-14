import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { processAllThreadsWithAI } from "@/lib/ai";
import { checkRateLimit, rateLimits } from "@/lib/cache";

export async function POST() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teamId = session.user.teamId;

  // Rate limit: 2 bulk AI process requests per minute per team
  const rateLimit = await checkRateLimit(`ai:process-all:${teamId}`, rateLimits.aiProcessAll);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        retryAfter: rateLimit.resetIn,
        current: rateLimit.current,
        limit: rateLimit.limit,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.resetIn) },
      }
    );
  }

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
