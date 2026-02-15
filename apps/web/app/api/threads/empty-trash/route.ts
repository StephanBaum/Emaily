import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { queueImapOperation } from "@emaily/mail-engine";
import { onThreadMutated } from "@/lib/thread-cache";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all trashed threads the user has access to
  const trashedThreads = await prisma.thread.findMany({
    where: {
      status: "trashed",
      mailbox: {
        access: { some: { userId: session.user.id } },
      },
    },
    include: {
      emails: {
        select: { id: true, imapUid: true, folder: true },
      },
      mailbox: {
        select: { id: true, folderTrash: true },
      },
    },
  });

  if (trashedThreads.length === 0) {
    return NextResponse.json({ message: "Trash is already empty", deleted: 0 });
  }

  // Group emails by mailbox for efficient IMAP operations
  const emailsByMailbox = new Map<string, { imapUid: number; folder: string }[]>();
  const threadIds: string[] = [];

  for (const thread of trashedThreads) {
    threadIds.push(thread.id);
    const mailboxId = thread.mailbox.id;
    const trashFolder = thread.mailbox.folderTrash;

    if (!emailsByMailbox.has(mailboxId)) {
      emailsByMailbox.set(mailboxId, []);
    }

    for (const email of thread.emails) {
      if (email.imapUid !== null) {
        emailsByMailbox.get(mailboxId)!.push({
          imapUid: email.imapUid,
          folder: trashFolder,
        });
      }
    }
  }

  // Queue IMAP operations per mailbox
  for (const [mailboxId, emails] of emailsByMailbox) {
    const trashFolder = trashedThreads.find(
      (t) => t.mailbox.id === mailboxId
    )?.mailbox.folderTrash;

    if (!trashFolder || emails.length === 0) continue;

    // Mark all emails as deleted
    for (const email of emails) {
      const markDeletedOp = await prisma.imapOperation.create({
        data: {
          mailboxId,
          operation: "add_flag",
          folder: trashFolder,
          imapUid: email.imapUid,
          payload: { flags: ["\\Deleted"] },
          status: "pending",
        },
      });

      await queueImapOperation(
        markDeletedOp.id,
        mailboxId,
        "add_flag",
        trashFolder,
        email.imapUid,
        { flags: ["\\Deleted"] }
      );
    }

    // Queue expunge for this mailbox's trash folder
    const expungeOp = await prisma.imapOperation.create({
      data: {
        mailboxId,
        operation: "expunge",
        folder: trashFolder,
        payload: {},
        status: "pending",
      },
    });

    await queueImapOperation(expungeOp.id, mailboxId, "expunge", trashFolder);
  }

  // Delete all trashed threads from database
  await prisma.thread.deleteMany({
    where: { id: { in: threadIds } },
  });

  // Invalidate cached thread data
  await Promise.all(threadIds.map((id) => onThreadMutated(id)));

  // Log activity
  await prisma.activityLog.create({
    data: {
      teamId: session.user.teamId,
      userId: session.user.id,
      action: "deleted_permanently",
      targetType: "bulk",
      targetId: "trash",
      metadata: { count: threadIds.length },
    },
  });

  return NextResponse.json({
    success: true,
    deleted: threadIds.length,
  });
}
