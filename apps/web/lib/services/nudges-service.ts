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
