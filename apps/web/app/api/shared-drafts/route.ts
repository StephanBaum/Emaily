import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { onThreadMutated } from "@/lib/thread-cache";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { threadId, mailboxId, subject, body: draftBody, toAddresses } = body;

  if (!mailboxId) {
    return NextResponse.json(
      { error: "mailboxId is required" },
      { status: 400 }
    );
  }

  // Verify access to mailbox
  const mailbox = await prisma.mailbox.findFirst({
    where: {
      id: mailboxId,
      access: {
        some: {
          userId: session.user.id,
          permission: { in: ["write", "admin"] },
        },
      },
    },
  });

  if (!mailbox) {
    return NextResponse.json(
      { error: "Mailbox not found or no write access" },
      { status: 404 }
    );
  }

  // If threadId provided, verify access to thread
  if (threadId) {
    const thread = await prisma.thread.findFirst({
      where: {
        id: threadId,
        mailboxId,
      },
    });

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Block drafts for quarantined (spam) threads
    if (thread.status === "quarantined") {
      return NextResponse.json(
        { error: "Cannot draft replies to quarantined threads. Mark as not spam first." },
        { status: 403 }
      );
    }

    // Check if draft already exists for this thread
    const existingDraft = await prisma.sharedDraft.findFirst({
      where: {
        threadId,
        status: { not: "sent" },
      },
    });

    if (existingDraft) {
      return NextResponse.json(
        { error: "A draft already exists for this thread", draftId: existingDraft.id },
        { status: 400 }
      );
    }
  }

  // Lock expires in 30 minutes
  const lockExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

  const draft = await prisma.sharedDraft.create({
    data: {
      threadId: threadId || null,
      mailboxId,
      createdById: session.user.id,
      subject: subject || "",
      body: draftBody || "",
      toAddresses: toAddresses || [],
      lockedById: session.user.id,
      lockType: "editing",
      lockExpiresAt,
    },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (threadId) {
    await onThreadMutated(threadId);
  }

  return NextResponse.json(draft, { status: 201 });
}
