// apps/web/lib/services/nudges-service.ts
import { prisma } from "@/lib/prisma";
import { STALE_THREAD_MS, MS_PER_DAY, NUDGE_LIMIT } from "@/lib/constants";

export interface NudgeThread {
  id: string;
  subject: string;
  senderName: string | null;
  senderEmail: string;
  senderTrustLevel: string | null;
  lastActivityAt: Date;
  daysSince: number;
  nudgeType: "needs_reply" | "awaiting_response";
}

export interface NudgesResponse {
  needsReply: NudgeThread[];
  awaitingResponse: NudgeThread[];
  totalNudges: number;
}

export function getStaleThreshold(): Date {
  return new Date(Date.now() - STALE_THREAD_MS);
}

export function calculateDaysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / MS_PER_DAY);
}

export function isFromMailbox(email: string, mailboxEmails: string[]): boolean {
  return mailboxEmails.includes(email.toLowerCase());
}

export async function getUserMailboxIds(userId: string): Promise<string[]> {
  const access = await prisma.mailboxAccess.findMany({
    where: { userId },
    select: { mailboxId: true },
  });
  return access.map((a) => a.mailboxId);
}

export async function getMailboxEmails(mailboxIds: string[]): Promise<string[]> {
  const mailboxes = await prisma.mailbox.findMany({
    where: { id: { in: mailboxIds } },
    select: { emailAddress: true },
  });
  return mailboxes.map((m) => m.emailAddress.toLowerCase());
}

interface ThreadWithEmails {
  id: string;
  subject: string;
  senderTrustLevel: string | null;
  lastActivityAt: Date;
  emails: {
    fromAddress: string;
    fromName: string | null;
    isSent: boolean;
    toAddresses: string[];
  }[];
}

async function queryNeedsReplyThreads(
  mailboxIds: string[],
  staleThreshold: Date
): Promise<ThreadWithEmails[]> {
  return prisma.thread.findMany({
    where: {
      mailboxId: { in: mailboxIds },
      status: "open",
      hasSentReply: false,
      lastActivityAt: { lt: staleThreshold },
      OR: [{ aiNeedsReply: true }, { aiNeedsReply: null }],
    },
    include: {
      emails: {
        orderBy: { date: "desc" },
        take: 1,
        select: {
          fromAddress: true,
          fromName: true,
          isSent: true,
          toAddresses: true,
        },
      },
    },
    orderBy: [{ senderTrustLevel: "asc" }, { lastActivityAt: "asc" }],
    take: NUDGE_LIMIT,
  });
}

async function queryAwaitingResponseThreads(
  mailboxIds: string[],
  staleThreshold: Date
): Promise<ThreadWithEmails[]> {
  return prisma.thread.findMany({
    where: {
      mailboxId: { in: mailboxIds },
      status: "open",
      lastActivityAt: { lt: staleThreshold },
    },
    include: {
      emails: {
        orderBy: { date: "desc" },
        take: 2,
        select: {
          fromAddress: true,
          fromName: true,
          isSent: true,
          toAddresses: true,
        },
      },
    },
    orderBy: [{ senderTrustLevel: "asc" }, { lastActivityAt: "asc" }],
    take: NUDGE_LIMIT,
  });
}

function mapToNeedsReplyNudge(
  thread: ThreadWithEmails,
  mailboxEmails: string[]
): NudgeThread | null {
  const lastEmail = thread.emails[0];
  if (!lastEmail) return null;

  const isInbound = !isFromMailbox(lastEmail.fromAddress, mailboxEmails);
  if (!isInbound) return null;

  return {
    id: thread.id,
    subject: thread.subject,
    senderName: lastEmail.fromName,
    senderEmail: lastEmail.fromAddress,
    senderTrustLevel: thread.senderTrustLevel,
    lastActivityAt: thread.lastActivityAt,
    daysSince: calculateDaysSince(thread.lastActivityAt),
    nudgeType: "needs_reply",
  };
}

function mapToAwaitingResponseNudge(
  thread: ThreadWithEmails,
  mailboxEmails: string[]
): NudgeThread | null {
  const lastEmail = thread.emails[0];
  if (!lastEmail) return null;

  const isOutbound =
    isFromMailbox(lastEmail.fromAddress, mailboxEmails) || lastEmail.isSent;
  if (!isOutbound) return null;

  const recipient = lastEmail.toAddresses?.[0] || "";
  const recipientName =
    thread.emails[1]?.fromName || recipient.split("@")[0] || "Unknown";

  return {
    id: thread.id,
    subject: thread.subject,
    senderName: recipientName,
    senderEmail: recipient,
    senderTrustLevel: thread.senderTrustLevel,
    lastActivityAt: thread.lastActivityAt,
    daysSince: calculateDaysSince(thread.lastActivityAt),
    nudgeType: "awaiting_response",
  };
}

export async function getNudgesForUser(userId: string): Promise<NudgesResponse> {
  // Single query replaces sequential getUserMailboxIds() + getMailboxEmails()
  const access = await prisma.mailboxAccess.findMany({
    where: { userId },
    include: { mailbox: { select: { id: true, emailAddress: true } } },
  });
  const mailboxIds = access.map((a) => a.mailbox.id);
  if (mailboxIds.length === 0) {
    return { needsReply: [], awaitingResponse: [], totalNudges: 0 };
  }

  const mailboxEmails = access.map((a) => a.mailbox.emailAddress.toLowerCase());
  const staleThreshold = getStaleThreshold();

  const [needsReplyThreads, awaitingResponseThreads] = await Promise.all([
    queryNeedsReplyThreads(mailboxIds, staleThreshold),
    queryAwaitingResponseThreads(mailboxIds, staleThreshold),
  ]);

  const needsReply = needsReplyThreads
    .map((thread) => mapToNeedsReplyNudge(thread, mailboxEmails))
    .filter((nudge): nudge is NudgeThread => nudge !== null);

  const awaitingResponse = awaitingResponseThreads
    .map((thread) => mapToAwaitingResponseNudge(thread, mailboxEmails))
    .filter((nudge): nudge is NudgeThread => nudge !== null);

  return {
    needsReply,
    awaitingResponse,
    totalNudges: needsReply.length + awaitingResponse.length,
  };
}
