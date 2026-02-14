import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { queueImapOperation } from "@emailautomation/mail-engine";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Get thread with emails and mailbox info
  const thread = await prisma.thread.findFirst({
    where: {
      id,
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

  if (!thread) {
    return NextResponse.json(
      { error: "Thread not found or not in trash" },
      { status: 404 }
    );
  }

  // Queue IMAP expunge operations for each email
  const emailsWithUid = thread.emails.filter((e) => e.imapUid !== null);
  for (const email of emailsWithUid) {
    // First mark as deleted on IMAP server (in Trash folder)
    const markDeletedOp = await prisma.imapOperation.create({
      data: {
        mailboxId: thread.mailbox.id,
        threadId: thread.id,
        emailId: email.id,
        operation: "add_flag",
        folder: thread.mailbox.folderTrash,
        imapUid: email.imapUid,
        payload: { flags: ["\\Deleted"] },
        status: "pending",
      },
    });

    await queueImapOperation(
      markDeletedOp.id,
      thread.mailbox.id,
      "add_flag",
      thread.mailbox.folderTrash,
      email.imapUid ?? undefined,
      { flags: ["\\Deleted"] }
    );
  }

  // Queue expunge operation for the trash folder
  const expungeOp = await prisma.imapOperation.create({
    data: {
      mailboxId: thread.mailbox.id,
      threadId: thread.id,
      operation: "expunge",
      folder: thread.mailbox.folderTrash,
      payload: {},
      status: "pending",
    },
  });

  await queueImapOperation(
    expungeOp.id,
    thread.mailbox.id,
    "expunge",
    thread.mailbox.folderTrash
  );

  // Delete thread and all related data from database
  await prisma.thread.delete({
    where: { id },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      teamId: session.user.teamId,
      userId: session.user.id,
      action: "deleted_permanently",
      targetType: "thread",
      targetId: id,
      metadata: { subject: thread.subject },
    },
  });

  return NextResponse.json({ success: true });
}
