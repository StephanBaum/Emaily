import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { queueImapOperation } from "@emailautomation/mail-engine";
import type { ImapOperationType, ThreadStatus } from "@emailautomation/shared";

const VALID_STATUSES: ThreadStatus[] = ["open", "archived", "snoozed", "quarantined", "trashed"];

// Map thread status to IMAP operation
function getImapOperationForStatus(
  oldStatus: string,
  newStatus: ThreadStatus
): ImapOperationType | null {
  if (newStatus === "archived") return "move_to_archive";
  if (newStatus === "trashed") return "move_to_trash";
  if (newStatus === "open" && (oldStatus === "archived" || oldStatus === "trashed")) {
    return "move_to_inbox";
  }
  // quarantined and snoozed are app-level states, no IMAP folder change
  return null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { status } = await request.json();

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  // Get thread with emails and mailbox info
  const thread = await prisma.thread.findFirst({
    where: {
      id,
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

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const oldStatus = thread.status;
  const imapOperation = getImapOperationForStatus(oldStatus, status);

  // Update thread in database
  const updated = await prisma.thread.update({
    where: { id },
    data: {
      status,
      trashedAt: status === "trashed" ? new Date() : null,
    },
  });

  // Queue IMAP operations for each email with a valid UID
  if (imapOperation) {
    const emailsWithUid = thread.emails.filter((e) => e.imapUid !== null);

    for (const email of emailsWithUid) {
      // Create ImapOperation record
      const operation = await prisma.imapOperation.create({
        data: {
          mailboxId: thread.mailbox.id,
          threadId: thread.id,
          emailId: email.id,
          operation: imapOperation,
          folder: email.folder,
          imapUid: email.imapUid,
          payload: {},
          status: "pending",
        },
      });

      // Queue the job
      await queueImapOperation(
        operation.id,
        thread.mailbox.id,
        imapOperation,
        email.folder,
        email.imapUid ?? undefined
      );
    }
  }

  // Log activity
  await prisma.activityLog.create({
    data: {
      teamId: session.user.teamId,
      userId: session.user.id,
      action: status === "trashed" ? "trashed" : status === "archived" ? "archived" : "status_changed",
      targetType: "thread",
      targetId: id,
      metadata: { oldStatus, newStatus: status },
    },
  });

  return NextResponse.json(updated);
}
