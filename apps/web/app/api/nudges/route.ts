import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface NudgeThread {
  id: string;
  subject: string;
  senderName: string | null;
  senderEmail: string;
  senderTrustLevel: string | null;
  lastActivityAt: Date;
  daysSince: number;
  nudgeType: "needs_reply" | "awaiting_response";
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  // Get user's mailbox IDs
  const mailboxIds = await prisma.mailboxAccess
    .findMany({
      where: { userId: session.user.id },
      select: { mailboxId: true },
    })
    .then((access) => access.map((a) => a.mailboxId));

  // Get mailbox email addresses (to identify outbound emails)
  const mailboxes = await prisma.mailbox.findMany({
    where: { id: { in: mailboxIds } },
    select: { id: true, emailAddress: true },
  });
  const mailboxEmails = mailboxes.map((m) => m.emailAddress.toLowerCase());

  // NUDGE TYPE 1: Threads that need a reply (inbound, no response, 3+ days old)
  // - Status is open (not archived/trashed)
  // - AI flagged as needs reply OR last email is inbound
  // - No sent reply yet
  // - Last activity > 3 days ago
  const needsReplyThreads = await prisma.thread.findMany({
    where: {
      mailboxId: { in: mailboxIds },
      status: "open",
      hasSentReply: false,
      lastActivityAt: { lt: threeDaysAgo },
      // Either AI flagged it or we'll check manually
      OR: [
        { aiNeedsReply: true },
        { aiNeedsReply: null }, // Not yet processed, still could need reply
      ],
    },
    include: {
      emails: {
        orderBy: { date: "desc" },
        take: 1,
        select: {
          fromAddress: true,
          fromName: true,
          isSent: true,
        },
      },
    },
    orderBy: [
      { senderTrustLevel: "asc" }, // VIP first (alphabetically vip > trusted > stranger)
      { lastActivityAt: "asc" }, // Oldest first
    ],
    take: 10,
  });

  // Filter to only threads where last email is inbound (not from us)
  const needsReply: NudgeThread[] = needsReplyThreads
    .filter((t) => {
      const lastEmail = t.emails[0];
      if (!lastEmail) return false;
      // Last email should NOT be from our mailboxes
      return !mailboxEmails.includes(lastEmail.fromAddress.toLowerCase());
    })
    .map((t) => ({
      id: t.id,
      subject: t.subject,
      senderName: t.emails[0]?.fromName || null,
      senderEmail: t.emails[0]?.fromAddress || "",
      senderTrustLevel: t.senderTrustLevel,
      lastActivityAt: t.lastActivityAt,
      daysSince: Math.floor(
        (now.getTime() - t.lastActivityAt.getTime()) / (24 * 60 * 60 * 1000)
      ),
      nudgeType: "needs_reply" as const,
    }));

  // NUDGE TYPE 2: Sent emails awaiting response (outbound, no reply, 3+ days)
  // - Status is open
  // - Last email is from us (sent)
  // - No reply received in 3+ days
  const awaitingResponseThreads = await prisma.thread.findMany({
    where: {
      mailboxId: { in: mailboxIds },
      status: "open",
      lastActivityAt: { lt: threeDaysAgo },
    },
    include: {
      emails: {
        orderBy: { date: "desc" },
        take: 2, // Get last 2 to see if last is sent and previous context
        select: {
          fromAddress: true,
          fromName: true,
          isSent: true,
          toAddresses: true,
        },
      },
    },
    orderBy: [
      { senderTrustLevel: "asc" },
      { lastActivityAt: "asc" },
    ],
    take: 10,
  });

  // Filter to only threads where last email IS from us (outbound)
  const awaitingResponse: NudgeThread[] = awaitingResponseThreads
    .filter((t) => {
      const lastEmail = t.emails[0];
      if (!lastEmail) return false;
      // Last email SHOULD be from our mailboxes (we sent it)
      return (
        mailboxEmails.includes(lastEmail.fromAddress.toLowerCase()) ||
        lastEmail.isSent
      );
    })
    .map((t) => {
      // For awaiting response, the "sender" is who we're waiting on
      // That's the recipient of our last email or the previous email's sender
      const lastEmail = t.emails[0];
      const recipient = lastEmail?.toAddresses?.[0] || "";
      const recipientName =
        t.emails[1]?.fromName || recipient.split("@")[0] || "Unknown";

      return {
        id: t.id,
        subject: t.subject,
        senderName: recipientName,
        senderEmail: recipient,
        senderTrustLevel: t.senderTrustLevel,
        lastActivityAt: t.lastActivityAt,
        daysSince: Math.floor(
          (now.getTime() - t.lastActivityAt.getTime()) / (24 * 60 * 60 * 1000)
        ),
        nudgeType: "awaiting_response" as const,
      };
    });

  return NextResponse.json({
    needsReply,
    awaitingResponse,
    totalNudges: needsReply.length + awaitingResponse.length,
  });
}
