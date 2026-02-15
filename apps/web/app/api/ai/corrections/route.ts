import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cacheInvalidatePattern } from "@/lib/cache";
import type { ActivityAction, TrustLevel } from "@emaily/shared";

interface CorrectionRequest {
  threadId: string;
  originalAction: ActivityAction;
  correctedAction: "unarchive" | "untag" | "delete_draft" | "unquarantine";
  tagId?: string; // For untag action
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: CorrectionRequest = await request.json();
  const { threadId, originalAction, correctedAction, tagId } = body;

  if (!threadId || !originalAction || !correctedAction) {
    return NextResponse.json(
      { error: "threadId, originalAction, and correctedAction are required" },
      { status: 400 }
    );
  }

  const teamId = session.user.teamId;

  // Verify thread access
  const thread = await prisma.thread.findFirst({
    where: {
      id: threadId,
      mailbox: {
        access: { some: { userId: session.user.id } },
      },
    },
    include: {
      emails: {
        where: { isSent: false },
        orderBy: { date: "desc" },
        take: 1,
        select: { fromAddress: true },
      },
    },
  });

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  // Log the correction
  await prisma.activityLog.create({
    data: {
      teamId,
      userId: session.user.id,
      action: "ai_correction",
      targetType: "thread",
      targetId: threadId,
      metadata: {
        originalAction,
        correctedAction,
        tagId: tagId || null,
      },
    },
  });

  // Apply the correction
  switch (correctedAction) {
    case "unarchive":
      await prisma.thread.update({
        where: { id: threadId },
        data: { status: "open" },
      });
      break;

    case "unquarantine":
      await prisma.thread.update({
        where: { id: threadId },
        data: { status: "open" },
      });
      break;

    case "untag":
      if (tagId) {
        await prisma.threadTag.deleteMany({
          where: { threadId, tagId, appliedBy: "ai" },
        });
      }
      break;

    case "delete_draft":
      // Delete AI-generated drafts for this thread (drafts created by an agent)
      await prisma.sharedDraft.deleteMany({
        where: {
          threadId,
          agentId: { not: null }, // AI-generated drafts have an agentId
        },
      });
      break;
  }

  // Invalidate tag caches — corrections change statuses and tag associations
  await cacheInvalidatePattern(`tags:${teamId}:*`);

  // Update contact trust level based on correction pattern
  // If user un-archives a stranger's email, bump them to "known"
  if (correctedAction === "unarchive" && originalAction === "ai_archived") {
    const senderEmail = thread.emails[0]?.fromAddress;
    if (senderEmail) {
      const contact = await prisma.contact.findUnique({
        where: { teamId_email: { teamId, email: senderEmail } },
      });

      if (contact && contact.trustLevel === "stranger") {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { trustLevel: "known" as TrustLevel },
        });
      }
    }
  }

  return NextResponse.json({
    success: true,
    threadId,
    correctedAction,
  });
}
