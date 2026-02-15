import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cacheInvalidatePattern } from "@/lib/cache";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: threadId } = await params;
  const body = await request.json();
  const { tagId } = body;

  if (!tagId) {
    return NextResponse.json(
      { error: "tagId is required" },
      { status: 400 }
    );
  }

  // Verify access to thread
  const thread = await prisma.thread.findFirst({
    where: {
      id: threadId,
      mailbox: {
        access: {
          some: { userId: session.user.id },
        },
      },
    },
    include: { mailbox: true },
  });

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  // Verify tag belongs to the same team
  const tag = await prisma.tag.findFirst({
    where: { id: tagId, teamId: thread.mailbox.teamId },
  });

  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
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
  await cacheInvalidatePattern(`tags:${thread.mailbox.teamId}:*`);

  return NextResponse.json(threadTag, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: threadId } = await params;
  const { searchParams } = new URL(request.url);
  const tagId = searchParams.get("tagId");

  if (!tagId) {
    return NextResponse.json(
      { error: "tagId query param is required" },
      { status: 400 }
    );
  }

  // Verify access to thread
  const thread = await prisma.thread.findFirst({
    where: {
      id: threadId,
      mailbox: {
        access: {
          some: { userId: session.user.id },
        },
      },
    },
    include: { mailbox: { select: { teamId: true } } },
  });

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  // Look up the tag to check if it's the spam tag
  const tag = await prisma.tag.findUnique({ where: { id: tagId } });

  await prisma.threadTag.deleteMany({
    where: { threadId, tagId },
  });

  // Invalidate tag caches so counts reflect the change
  await cacheInvalidatePattern(`tags:${thread.mailbox.teamId}:*`);

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

  return NextResponse.json({ success: true });
}
