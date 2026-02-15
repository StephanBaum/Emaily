import { prisma } from "@/lib/prisma";
import { queueImapOperation } from "@emaily/mail-engine";
import { cacheInvalidatePattern } from "@/lib/cache";
import { requireAuth, verifyThreadAccess, apiError } from "@/lib/api-helpers";
import type { ImapOperationType, ThreadStatus } from "@emaily/shared";

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
  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id } = await params;
  const { status } = await request.json();

  if (!status || !VALID_STATUSES.includes(status)) {
    return apiError(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
  }

  const { thread, error: accessError } = await verifyThreadAccess(session.user.id, id, {
    emails: {
      select: { id: true, imapUid: true, folder: true },
    },
    mailbox: {
      select: { id: true },
    },
  });
  if (accessError) return accessError;

  const oldStatus = thread.status;
  const imapOperation = getImapOperationForStatus(oldStatus, status);
  const emails = (thread as any).emails;
  const mailbox = (thread as any).mailbox;

  // Update thread in database
  const updated = await prisma.thread.update({
    where: { id },
    data: {
      status,
      trashedAt: status === "trashed" ? new Date() : null,
    },
  });

  // Invalidate tag caches — status changes affect tag thread counts
  await cacheInvalidatePattern(`tags:${session.user.teamId}:*`);

  // Queue IMAP operations for each email with a valid UID
  if (imapOperation) {
    const emailsWithUid = emails.filter((e: any) => e.imapUid !== null);

    for (const email of emailsWithUid) {
      const operation = await prisma.imapOperation.create({
        data: {
          mailboxId: mailbox.id,
          threadId: thread.id,
          emailId: email.id,
          operation: imapOperation,
          folder: email.folder,
          imapUid: email.imapUid,
          payload: {},
          status: "pending",
        },
      });

      await queueImapOperation(
        operation.id,
        mailbox.id,
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

  return Response.json(updated);
}
