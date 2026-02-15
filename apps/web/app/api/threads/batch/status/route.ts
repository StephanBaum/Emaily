import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { queueBatchImapOperation } from "@emaily/mail-engine";
import { cacheInvalidatePattern } from "@/lib/cache";
import { onThreadMutated } from "@/lib/thread-cache";
import type { ImapOperationType, ThreadStatus } from "@emaily/shared";

const VALID_STATUSES: ThreadStatus[] = ["open", "archived", "snoozed", "quarantined", "trashed"];

function getImapOperationForStatus(newStatus: ThreadStatus): ImapOperationType | null {
  if (newStatus === "archived") return "move_to_archive";
  if (newStatus === "trashed") return "move_to_trash";
  if (newStatus === "open") return "move_to_inbox";
  return null;
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadIds, status } = await request.json();

  if (!Array.isArray(threadIds) || threadIds.length === 0) {
    return NextResponse.json({ error: "threadIds must be a non-empty array" }, { status: 400 });
  }

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  // Get threads with emails and mailbox info
  const threads = await prisma.thread.findMany({
    where: {
      id: { in: threadIds },
      mailbox: {
        access: { some: { userId: session.user.id } },
      },
    },
    include: {
      emails: {
        select: { id: true, imapUid: true, folder: true },
      },
      mailbox: {
        select: { id: true },
      },
    },
  });

  if (threads.length === 0) {
    return NextResponse.json({ error: "No accessible threads found" }, { status: 404 });
  }

  const imapOperation = getImapOperationForStatus(status);

  // Update all threads in database
  await prisma.thread.updateMany({
    where: { id: { in: threads.map((t) => t.id) } },
    data: {
      status,
      trashedAt: status === "trashed" ? new Date() : null,
    },
  });

  // Invalidate tag + thread caches — status changes affect tag thread counts
  await Promise.all([
    cacheInvalidatePattern(`tags:${session.user.teamId}:*`),
    ...threads.map((t) => onThreadMutated(t.id)),
  ]);

  // Group emails by mailbox and folder for batch IMAP operations
  if (imapOperation) {
    const emailsByMailboxFolder = new Map<string, { mailboxId: string; folder: string; uids: number[]; emailIds: string[] }>();

    for (const thread of threads) {
      for (const email of thread.emails) {
        if (email.imapUid === null) continue;

        const key = `${thread.mailbox.id}:${email.folder}`;
        if (!emailsByMailboxFolder.has(key)) {
          emailsByMailboxFolder.set(key, {
            mailboxId: thread.mailbox.id,
            folder: email.folder,
            uids: [],
            emailIds: [],
          });
        }
        emailsByMailboxFolder.get(key)!.uids.push(email.imapUid);
        emailsByMailboxFolder.get(key)!.emailIds.push(email.id);
      }
    }

    // Create batch IMAP operations
    for (const [, { mailboxId, folder, uids, emailIds }] of emailsByMailboxFolder) {
      const operations = await prisma.imapOperation.createManyAndReturn({
        data: emailIds.map((emailId, i) => ({
          mailboxId,
          emailId,
          operation: imapOperation,
          folder,
          imapUid: uids[i],
          payload: {},
          status: "pending",
        })),
      });

      // Queue batch operation
      await queueBatchImapOperation(
        operations.map((op) => op.id),
        mailboxId,
        imapOperation,
        folder,
        uids
      );
    }
  }

  // Log activity
  await prisma.activityLog.create({
    data: {
      teamId: session.user.teamId,
      userId: session.user.id,
      action: status === "trashed" ? "trashed" : status === "archived" ? "archived" : "status_changed",
      targetType: "batch",
      targetId: "threads",
      metadata: { count: threads.length, status },
    },
  });

  return NextResponse.json({ success: true, updated: threads.length });
}
