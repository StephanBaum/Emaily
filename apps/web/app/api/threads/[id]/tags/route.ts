import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { cacheInvalidatePattern } from "@/lib/cache";
import { requireAuth, verifyThreadAccess, apiError, apiSuccess } from "@/lib/api-helpers";
import { onThreadMutated } from "@/lib/thread-cache";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id: threadId } = await params;
  const body = await request.json();
  const { tagId } = body;

  if (!tagId) {
    return apiError("tagId is required", 400);
  }

  const { thread, error: accessError } = await verifyThreadAccess(session.user.id, threadId, {
    mailbox: true,
  });
  if (accessError) return accessError;

  const mailbox = (thread as any).mailbox;

  // Verify tag belongs to the same team
  const tag = await prisma.tag.findFirst({
    where: { id: tagId, teamId: mailbox.teamId },
  });

  if (!tag) {
    return apiError("Tag not found", 404);
  }

  // Spam tag → quarantine the thread (bidirectional spam/quarantine sync)
  const isSpamTag = tag.name.toLowerCase() === "spam";
  if (isSpamTag && thread.status !== "quarantined") {
    await prisma.thread.update({
      where: { id: threadId },
      data: { status: "quarantined" },
    });
  }

  // Upsert to avoid duplicate errors
  const threadTag = await prisma.threadTag.upsert({
    where: {
      threadId_tagId: { threadId, tagId },
    },
    update: {},
    create: {
      threadId,
      tagId,
      appliedBy: "manual",
    },
    include: {
      tag: {
        select: { id: true, name: true, color: true },
      },
    },
  });

  // Invalidate tag caches so counts reflect the change
  await Promise.all([
    cacheInvalidatePattern(`tags:${mailbox.teamId}:*`),
    onThreadMutated(threadId),
  ]);

  return Response.json(threadTag, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id: threadId } = await params;
  const { searchParams } = new URL(request.url);
  const tagId = searchParams.get("tagId");

  if (!tagId) {
    return apiError("tagId query param is required", 400);
  }

  const { thread, error: accessError } = await verifyThreadAccess(session.user.id, threadId, {
    mailbox: { select: { teamId: true } },
  });
  if (accessError) return accessError;

  const teamId = (thread as any).mailbox.teamId;

  // Look up the tag to check if it's the spam tag
  const tag = await prisma.tag.findUnique({ where: { id: tagId } });

  await prisma.threadTag.deleteMany({
    where: { threadId, tagId },
  });

  // Invalidate tag + thread caches so counts reflect the change
  await Promise.all([
    cacheInvalidatePattern(`tags:${teamId}:*`),
    onThreadMutated(threadId),
  ]);

  // Removing spam tag → un-quarantine the thread and elevate sender trust
  if (tag && tag.name.toLowerCase() === "spam" && thread.status === "quarantined") {
    await prisma.thread.update({
      where: { id: threadId },
      data: { status: "open" },
    });

    // Learn: elevate sender trust to "known" (not spam)
    const latestEmail = await prisma.email.findFirst({
      where: { threadId, isSent: false },
      orderBy: { date: "desc" },
    });
    if (latestEmail) {
      await prisma.contact.updateMany({
        where: {
          teamId: thread.teamId,
          email: latestEmail.fromAddress.toLowerCase(),
          trustLevel: "stranger",
        },
        data: { trustLevel: "known" },
      });
    }
  }

  return apiSuccess();
}
