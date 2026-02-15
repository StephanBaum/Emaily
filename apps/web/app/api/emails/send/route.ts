import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SmtpClient } from "@emaily/mail-engine";
import { decrypt } from "@emaily/security";
import { onThreadEmailAdded } from "@/lib/thread-cache";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { threadId, mailboxId, to, cc, bcc, subject, body: emailBody, sharedDraftId } = body;

  if (!mailboxId || !to || !subject || !emailBody) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Verify mailbox access
  const access = await prisma.mailboxAccess.findUnique({
    where: {
      userId_mailboxId: {
        userId: session.user.id,
        mailboxId,
      },
    },
  });

  if (!access || access.permission === "read") {
    return NextResponse.json(
      { error: "No permission to send from this mailbox" },
      { status: 403 }
    );
  }

  // Get mailbox with SMTP config
  const mailbox = await prisma.mailbox.findUnique({
    where: { id: mailboxId },
  });

  if (!mailbox || !mailbox.smtpHost || !mailbox.smtpPasswordEnc) {
    return NextResponse.json(
      { error: "Mailbox not configured for sending" },
      { status: 400 }
    );
  }

  // Decrypt SMTP password
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const smtpPassword = decrypt(mailbox.smtpPasswordEnc, encryptionKey);

  // Get thread info if replying
  let inReplyTo: string | undefined;
  let references: string[] = [];

  if (threadId) {
    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
      include: {
        emails: {
          orderBy: { date: "desc" },
          take: 1,
          select: {
            messageId: true,
            references: true,
          },
        },
      },
    });

    // Block replies to quarantined (spam) threads
    if (thread?.status === "quarantined") {
      return NextResponse.json(
        { error: "Cannot reply to quarantined threads. Mark as not spam first." },
        { status: 403 }
      );
    }

    if (thread?.emails[0]) {
      inReplyTo = thread.emails[0].messageId;
      references = [...thread.emails[0].references, thread.emails[0].messageId];
    }
  }

  try {
    // Create SMTP client
    const smtpClient = new SmtpClient({
      host: mailbox.smtpHost,
      port: mailbox.smtpPort || 587,
      secure: (mailbox.smtpPort || 587) === 465,
      auth: {
        user: mailbox.smtpUser || mailbox.emailAddress,
        pass: smtpPassword,
      },
    });

    // Send email
    const sentEmail = await smtpClient.send({
      from: mailbox.emailAddress,
      to: Array.isArray(to) ? to : [to],
      cc: cc || [],
      bcc: bcc || [],
      subject,
      text: emailBody,
      html: `<p>${emailBody.replace(/\n/g, "</p><p>")}</p>`,
      inReplyTo,
      references,
    });

    // Save to database
    let targetThreadId = threadId;

    // Create thread if not replying
    if (!targetThreadId) {
      const newThread = await prisma.thread.create({
        data: {
          mailboxId,
          teamId: session.user.teamId,
          subject,
          status: "open",
          hasSentReply: true,
        },
      });
      targetThreadId = newThread.id;
    } else {
      // Update thread
      await prisma.thread.update({
        where: { id: targetThreadId },
        data: {
          hasSentReply: true,
          lastActivityAt: new Date(),
        },
      });
    }

    // Create email record
    const email = await prisma.email.create({
      data: {
        threadId: targetThreadId,
        messageId: sentEmail.messageId,
        inReplyTo: inReplyTo || null,
        references,
        subject,
        bodyText: emailBody,
        bodyHtml: `<p>${emailBody.replace(/\n/g, "</p><p>")}</p>`,
        fromAddress: mailbox.emailAddress,
        fromName: mailbox.displayName,
        toAddresses: Array.isArray(to) ? to : [to],
        ccAddresses: cc || [],
        bccAddresses: bcc || [],
        date: new Date(),
        folder: "Sent",
        isSent: true,
        isBot: false,
      },
    });

    // Invalidate thread email cache
    await onThreadEmailAdded(targetThreadId);

    // Mark shared draft as sent (if sending from a shared draft)
    if (sharedDraftId) {
      await prisma.sharedDraft.updateMany({
        where: { id: sharedDraftId, threadId: targetThreadId },
        data: { status: "sent", lockedById: null, lockExpiresAt: null, lockType: null },
      });
    } else if (targetThreadId) {
      // Fallback: mark any active draft for this thread as sent
      await prisma.sharedDraft.updateMany({
        where: { threadId: targetThreadId, status: { not: "sent" } },
        data: { status: "sent", lockedById: null, lockExpiresAt: null, lockType: null },
      });
    }

    await smtpClient.close();

    return NextResponse.json({
      success: true,
      emailId: email.id,
      threadId: targetThreadId,
    });
  } catch (error) {
    console.error("Failed to send email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send email" },
      { status: 500 }
    );
  }
}
