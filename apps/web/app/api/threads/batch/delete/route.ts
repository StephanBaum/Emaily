import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { queueBatchImapOperation } from "@emaily/mail-engine";
import { cacheInvalidatePattern } from "@/lib/cache";
import { onThreadMutated } from "@/lib/thread-cache";

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadIds } = await request.json();

  if (!Array.isArray(threadIds) || threadIds.length === 0) {
    return NextResponse.json({ error: "threadIds must be a non-empty array" }, { status: 400 });
  }

  // Get trashed threads with emails and mailbox info
  const threads = await prisma.thread.findMany({
    where: {
      id: { in: threadIds },
      status: "trashed", // Can only permanently delete from trash
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

  if (threads.length === 0) {
    return NextResponse.json(
      { error: "No accessible trashed threads found" },
      { status: 404 }
    );
  }

  // Group emails by mailbox for batch IMAP operations
  const emailsByMailbox = new Map<string, { trashFolder: string; uids: number[]; emailIds: string[] }>();

  for (const thread of threads) {
    const mailboxId = thread.mailbox.id;
    const trashFolder = thread.mailbox.folderTrash;

    if (!emailsByMailbox.has(mailboxId)) {
      emailsByMailbox.set(mailboxId, { trashFolder, uids: [], emailIds: [] });
    }

    for (const email of thread.emails) {
      if (email.imapUid !== null) {
        emailsByMailbox.get(mailboxId)!.uids.push(email.imapUid);
        emailsByMailbox.get(mailboxId)!.emailIds.push(email.id);
      }
    }
  }

  // Queue IMAP delete + expunge operations per mailbox
  for (const [mailboxId, { trashFolder, uids, emailIds }] of emailsByMailbox) {
    if (uids.length === 0) continue;

    // Create batch operations for marking as deleted
    const operations = await prisma.imapOperation.createManyAndReturn({
      data: emailIds.map((emailId, i) => ({
        mailboxId,
        emailId,
        operation: "add_flag",
        folder: trashFolder,
        imapUid: uids[i],
        payload: { flags: ["\\Deleted"] },
        status: "pending",
      })),
    });

    // Queue batch add_flag operation
    await queueBatchImapOperation(
      operations.map((op) => op.id),
      mailboxId,
      "add_flag",
      trashFolder,
      uids,
      { flags: ["\\Deleted"] }
    );

    // Queue expunge operation
    const expungeOp = await prisma.imapOperation.create({
      data: {
        mailboxId,
        operation: "expunge",
        folder: trashFolder,
        payload: {},
        status: "pending",
      },
    });

    // Note: expunge is not a batch operation, queue individually
    const { queueImapOperation } = await import("@emaily/mail-engine");
    await queueImapOperation(expungeOp.id, mailboxId, "expunge", trashFolder);
  }

  // Delete threads from database
  await prisma.thread.deleteMany({
    where: { id: { in: threads.map((t) => t.id) } },
  });

  // Invalidate tag + thread caches — deleted threads affect tag counts
  await Promise.all([
    cacheInvalidatePattern(`tags:${session.user.teamId}:*`),
    ...threads.map((t) => onThreadMutated(t.id)),
  ]);

  // Log activity
  await prisma.activityLog.create({
    data: {
      teamId: session.user.teamId,
      userId: session.user.id,
      action: "deleted_permanently",
      targetType: "batch",
      targetId: "threads",
      metadata: { count: threads.length },
    },
  });

  return NextResponse.json({ success: true, deleted: threads.length });
}
