import { prisma } from "@/lib/prisma";
import {
  cacheGet,
  cacheSet,
  cacheMultiGet,
  cacheInvalidate,
  cacheKeys,
  CACHE_TTL,
} from "@/lib/cache";

// --- Types for cached data ---

/** Email shape cached in Redis (matches the include used in thread detail queries) */
interface CachedEmail {
  id: string;
  threadId: string;
  messageId: string;
  inReplyTo: string | null;
  references: string[];
  imapUid: number | null;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  date: string; // ISO string in cache
  folder: string;
  isDraft: boolean;
  isSent: boolean;
  isBot: boolean;
  spamScore: number | null;
  spamAnalysis: unknown;
  rawHeaders: unknown;
  createdAt: string;
  updatedAt: string;
  attachments: {
    id: string;
    filename: string;
    contentType: string;
    size: number;
  }[];
}

// --- Email cache (immutable, 24h TTL) ---

/**
 * Get emails for a thread, using Redis cache when available.
 * Falls through to DB on any cache miss and populates cache.
 */
export async function getCachedThreadEmails(threadId: string): Promise<CachedEmail[]> {
  // 1. Check thread-emails index for list of email IDs
  const emailIds = await cacheGet<string[]>(cacheKeys.threadEmails(threadId));

  if (emailIds && emailIds.length > 0) {
    // 2. Multi-get all individual email keys
    const emailKeys = emailIds.map((id) => cacheKeys.email(id));
    const cached = await cacheMultiGet<CachedEmail>(emailKeys);

    // 3. If all hit, return sorted
    if (cached.every((e) => e !== null)) {
      console.debug(`[Cache] HIT thread-emails:${threadId} (${emailIds.length} emails)`);
      return (cached as CachedEmail[]).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    }
    // Partial miss — fall through to DB
  }

  console.debug(`[Cache] MISS thread-emails:${threadId}`);

  // 4. Fetch from DB
  const emails = await prisma.email.findMany({
    where: { threadId },
    orderBy: { date: "asc" },
    include: {
      attachments: {
        select: {
          id: true,
          filename: true,
          contentType: true,
          size: true,
        },
      },
    },
  });

  // 5. Populate cache
  if (emails.length > 0) {
    await cacheEmailsForThread(threadId, emails);
  }

  // 6. Return as CachedEmail (serialize dates)
  return emails.map(serializeEmail);
}

/** Store each email individually + the thread's email ID list */
async function cacheEmailsForThread(
  threadId: string,
  emails: Array<{
    id: string;
    [key: string]: unknown;
  }>
): Promise<void> {
  const serialized = emails.map(serializeEmail);

  // Cache email ID list
  const ids = serialized.map((e) => e.id);
  await cacheSet(cacheKeys.threadEmails(threadId), ids, CACHE_TTL.email);

  // Cache each email individually (fire and forget for speed)
  await Promise.all(
    serialized.map((email) =>
      cacheSet(cacheKeys.email(email.id), email, CACHE_TTL.email)
    )
  );
}

function serializeEmail(email: Record<string, unknown>): CachedEmail {
  return {
    id: email.id as string,
    threadId: email.threadId as string,
    messageId: email.messageId as string,
    inReplyTo: email.inReplyTo as string | null,
    references: email.references as string[],
    imapUid: email.imapUid as number | null,
    subject: email.subject as string,
    bodyText: email.bodyText as string,
    bodyHtml: email.bodyHtml as string | null,
    fromAddress: email.fromAddress as string,
    fromName: email.fromName as string | null,
    toAddresses: email.toAddresses as string[],
    ccAddresses: email.ccAddresses as string[],
    bccAddresses: email.bccAddresses as string[],
    date: email.date instanceof Date ? email.date.toISOString() : (email.date as string),
    folder: email.folder as string,
    isDraft: email.isDraft as boolean,
    isSent: email.isSent as boolean,
    isBot: email.isBot as boolean,
    spamScore: email.spamScore as number | null,
    spamAnalysis: email.spamAnalysis,
    rawHeaders: email.rawHeaders,
    createdAt: email.createdAt instanceof Date ? email.createdAt.toISOString() : (email.createdAt as string),
    updatedAt: email.updatedAt instanceof Date ? email.updatedAt.toISOString() : (email.updatedAt as string),
    attachments: email.attachments as CachedEmail["attachments"],
  };
}

// --- Invalidation functions ---

/**
 * Call when a thread's metadata changes (status, tags, assignments, comments, drafts).
 * Does NOT invalidate email cache since emails don't change on thread mutations.
 */
export async function onThreadMutated(threadId: string): Promise<void> {
  await cacheInvalidate(cacheKeys.thread(threadId));
}

/**
 * Call when a new email is added to a thread (sync, send, auto-reply).
 * Invalidates both thread metadata and email list caches.
 */
export async function onThreadEmailAdded(threadId: string): Promise<void> {
  await Promise.all([
    cacheInvalidate(cacheKeys.thread(threadId)),
    cacheInvalidate(cacheKeys.threadEmails(threadId)),
  ]);
}
