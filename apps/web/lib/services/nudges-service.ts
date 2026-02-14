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
