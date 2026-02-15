import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processThreadWithAI } from "@/lib/ai";
import { checkRateLimit, rateLimits } from "@/lib/cache";
import type { AIProcessingResult } from "@emaily/shared";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teamId = session.user.teamId;

  // Rate limit: 10 AI process requests per minute per team
  const rateLimit = await checkRateLimit(`ai:process:${teamId}`, rateLimits.aiProcess);
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

  const body = await request.json();
  const { emailId, threadId, agentId } = body;

  if (threadId) {
    // Process the entire thread with a single LLM call
    const thread = await prisma.thread.findFirst({
      where: {
        id: threadId,
        mailbox: {
          access: { some: { userId: session.user.id } },
        },
      },
      select: { id: true },
    });

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const result = await processThreadWithAI(threadId, teamId, { agentId, force: true });
    return NextResponse.json({
      processed: [threadId],
      result: summarizeResult(result),
    });
  } else if (emailId) {
    // Resolve email to thread, then process thread
    const email = await prisma.email.findFirst({
      where: {
        id: emailId,
        thread: {
          mailbox: {
            access: { some: { userId: session.user.id } },
          },
        },
      },
      select: { id: true, threadId: true },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    const result = await processThreadWithAI(email.threadId, teamId, { agentId, force: true });
    return NextResponse.json({
      processed: [email.threadId],
      result: summarizeResult(result),
    });
  } else {
    return NextResponse.json(
      { error: "emailId or threadId is required" },
      { status: 400 }
    );
  }
}

function summarizeResult(result: AIProcessingResult) {
  return {
    tags: result.tagsApplied.length,
    intents: result.intentsExtracted.length,
    draft: result.draftGenerated,
    draftId: result.draftId ?? null,
    actions: result.actionsExecuted.length,
    actionsExecuted: result.actionsExecuted,
    agentId: result.agentId,
    agentName: result.agentName,
    error: result.error,
  };
}
