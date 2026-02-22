import { Worker, Queue } from "bullmq";
import { prisma } from "@emaily/database";
import {
  MailboxSyncer,
  type SyncCallbacks,
  type EmailToStore,
  type ThreadToCreate,
  analyzeSpam,
  SPAM_THRESHOLD_QUARANTINE,
} from "@emaily/mail-engine";
import { decrypt, encrypt } from "@emaily/security";
import Redis from "ioredis";
import { SYNC_QUEUE_NAME, getRedisConnection } from "./queues";
import type { SyncMailboxJob } from "./queues";

const AI_QUEUE_NAME = "ai-processing";
const CACHE_PREFIX = "emaily:cache:";

// Cache key builders (mirroring apps/web/lib/cache.ts)
const cacheKeys = {
  thread: (threadId: string) => `thread:${threadId}`,
  threadEmails: (threadId: string) => `thread-emails:${threadId}`,
};

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    redis = new Redis(url);
    redis.on("error", (err) => {
      console.error("[Sync Worker] Redis error:", err.message);
    });
  }
  return redis;
}

/** Invalidate thread + thread-emails cache when a new email arrives */
async function onThreadEmailAdded(threadId: string): Promise<void> {
  const client = getRedis();
  await Promise.all([
    client.del(CACHE_PREFIX + cacheKeys.thread(threadId)),
    client.del(CACHE_PREFIX + cacheKeys.threadEmails(threadId)),
  ]);
}

/** Upsert contact from incoming email (mirrors apps/web/lib/contacts.ts) */
async function upsertContactFromEmail(
  teamId: string,
  fromAddress: string,
  fromName: string | null
): Promise<{ trustLevel: string; contactId: string }> {
  const domain = fromAddress.split("@")[1]?.toLowerCase() || null;

  const contact = await prisma.contact.upsert({
    where: {
      teamId_email: { teamId, email: fromAddress.toLowerCase() },
    },
    update: {
      interactionCount: { increment: 1 },
      lastContactedAt: new Date(),
      ...(fromName ? { name: fromName } : {}),
    },
    create: {
      teamId,
      email: fromAddress.toLowerCase(),
      name: fromName || null,
      domain,
      trustLevel: "known",
      interactionCount: 1,
      autoLearned: true,
      lastContactedAt: new Date(),
    },
  });

  return {
    trustLevel: contact.trustLevel,
    contactId: contact.id,
  };
}

/**
 * Process a single mailbox sync job.
 * Connects to IMAP, fetches new emails, creates threads, and queues AI processing.
 */
export async function processSyncJob(
  job: { data: SyncMailboxJob },
  aiQueue: Queue
): Promise<{ newEmails: number; newThreads: number; errors: string[] }> {
  const { mailboxId, emailAddress } = job.data;

  const mailbox = await prisma.mailbox.findUnique({
    where: { id: mailboxId },
  });

  if (!mailbox || !mailbox.imapHost || !mailbox.imapPasswordEnc) {
    console.warn(`[Sync Worker] Mailbox ${mailboxId} not found or not configured, skipping`);
    return { newEmails: 0, newThreads: 0, errors: [] };
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY not configured");
  }

  let imapPassword: string;
  try {
    imapPassword = decrypt(mailbox.imapPasswordEnc, encryptionKey);
  } catch {
    if (process.env.NODE_ENV !== "production") {
      // Dev mode: encryption key mismatch from seed — re-encrypt with current key
      imapPassword = mailbox.imapUser || "test";
      const fixed = encrypt(imapPassword, encryptionKey);
      await prisma.mailbox.update({
        where: { id: mailbox.id },
        data: { imapPasswordEnc: fixed, smtpPasswordEnc: fixed },
      });
      console.warn(`[Sync Worker] Re-encrypted credentials for ${emailAddress} (key mismatch)`);
    } else {
      throw new Error("Failed to decrypt IMAP credentials");
    }
  }

  // Track new inbound email IDs for AI processing
  const newInboundEmailIds: { emailId: string; teamId: string }[] = [];

  const callbacks: SyncCallbacks = {
    getExistingThreads: async () => {
      const threads = await prisma.thread.findMany({
        where: { mailboxId: mailbox.id },
        include: {
          emails: {
            select: { messageId: true },
          },
        },
      });
      return threads.map((t) => ({
        id: t.id,
        subject: t.subject,
        messageIds: t.emails.map((e) => e.messageId),
      }));
    },

    addEmailToThread: async (threadId: string, email: EmailToStore) => {
      // Skip if this email already exists (duplicate sync / retry)
      const existing = await prisma.email.findUnique({
        where: { messageId: email.messageId },
        select: { id: true },
      });
      if (existing) return;

      const spamAnalysis = analyzeSpam({
        headers: email.headers,
        fromAddress: email.fromAddress,
        subject: email.subject,
      });

      const created = await prisma.email.create({
        data: {
          threadId,
          messageId: email.messageId,
          inReplyTo: email.inReplyTo,
          references: email.references,
          imapUid: email.uid,
          subject: email.subject,
          bodyText: email.bodyText,
          bodyHtml: email.bodyHtml,
          fromAddress: email.fromAddress,
          fromName: email.fromName,
          toAddresses: email.toAddresses,
          ccAddresses: email.ccAddresses,
          date: email.date,
          folder: email.folder,
          isBot: email.isBot,
          spamScore: spamAnalysis.headerScore,
          spamAnalysis: JSON.parse(JSON.stringify(spamAnalysis)),
          rawHeaders: email.headers,
        },
      });

      const currentThread = await prisma.thread.findUnique({
        where: { id: threadId },
        select: { status: true, teamId: true },
      });

      const shouldReopen = currentThread?.status === "archived";
      const isInbound = email.fromAddress.toLowerCase() !== mailbox.emailAddress.toLowerCase();

      await prisma.thread.update({
        where: { id: threadId },
        data: {
          lastActivityAt: new Date(),
          ...(shouldReopen && { status: "open" }),
          ...(isInbound && { aiStatus: "pending" }),
        },
      });

      if (shouldReopen && currentThread) {
        await prisma.activityLog.create({
          data: {
            teamId: currentThread.teamId,
            action: "thread_reopened",
            targetType: "thread",
            targetId: threadId,
            metadata: {
              previousStatus: "archived",
              triggerEmailId: created.id,
            },
          },
        });
      }

      await onThreadEmailAdded(threadId);

      await upsertContactFromEmail(
        mailbox.teamId,
        email.fromAddress,
        email.fromName
      );

      // Track inbound emails for AI processing
      if (isInbound) {
        newInboundEmailIds.push({ emailId: created.id, teamId: mailbox.teamId });
      }
    },

    createThread: async (_mailboxId: string, _teamId: string, thread: ThreadToCreate) => {
      const firstEmail = thread.emails[0];
      const spamAnalysis = analyzeSpam({
        headers: firstEmail.headers,
        fromAddress: firstEmail.fromAddress,
        subject: firstEmail.subject,
      });

      const { trustLevel } = await upsertContactFromEmail(
        mailbox.teamId,
        firstEmail.fromAddress,
        firstEmail.fromName
      );

      const shouldQuarantine =
        spamAnalysis.headerScore >= SPAM_THRESHOLD_QUARANTINE &&
        trustLevel !== "trusted" &&
        trustLevel !== "vip";

      const newThread = await prisma.thread.create({
        data: {
          mailboxId: mailbox.id,
          teamId: mailbox.teamId,
          subject: thread.subject,
          status: shouldQuarantine ? "quarantined" : "open",
          senderTrustLevel: trustLevel,
          lastActivityAt: new Date(),
          emails: {
            create: thread.emails.map((email) => {
              const emailSpam =
                email === firstEmail
                  ? spamAnalysis
                  : analyzeSpam({
                      headers: email.headers,
                      fromAddress: email.fromAddress,
                      subject: email.subject,
                    });
              return {
                messageId: email.messageId,
                inReplyTo: email.inReplyTo,
                references: email.references,
                imapUid: email.uid,
                subject: email.subject,
                bodyText: email.bodyText,
                bodyHtml: email.bodyHtml,
                fromAddress: email.fromAddress,
                fromName: email.fromName,
                toAddresses: email.toAddresses,
                ccAddresses: email.ccAddresses,
                date: email.date,
                folder: email.folder,
                isBot: email.isBot,
                spamScore: emailSpam.headerScore,
                spamAnalysis: JSON.parse(JSON.stringify(emailSpam)),
                rawHeaders: email.headers,
              };
            }),
          },
        },
        include: {
          emails: { select: { id: true } },
        },
      });

      await onThreadEmailAdded(newThread.id);

      // Track new thread emails for AI processing (inbound only)
      const isInbound = firstEmail.fromAddress.toLowerCase() !== mailbox.emailAddress.toLowerCase();
      if (isInbound && !shouldQuarantine) {
        for (const email of newThread.emails) {
          newInboundEmailIds.push({ emailId: email.id, teamId: mailbox.teamId });
        }
      }

      return newThread.id;
    },

    updateSyncState: async (_mailboxId: string, state) => {
      await prisma.mailboxSync.upsert({
        where: {
          mailboxId_folderName: {
            mailboxId: mailbox.id,
            folderName: state.folderName,
          },
        },
        update: {
          lastUid: state.lastUid,
          lastSyncAt: state.lastSyncAt,
          syncStatus: "idle",
          errorMessage: null,
        },
        create: {
          mailboxId: mailbox.id,
          folderName: state.folderName,
          lastUid: state.lastUid,
          lastSyncAt: state.lastSyncAt,
          syncStatus: "idle",
        },
      });
    },

    getSyncState: async (_mailboxId: string, folder: string) => {
      const state = await prisma.mailboxSync.findUnique({
        where: {
          mailboxId_folderName: {
            mailboxId: mailbox.id,
            folderName: folder,
          },
        },
      });
      return state
        ? {
            folderName: state.folderName,
            lastUid: state.lastUid,
            lastSyncAt: state.lastSyncAt,
          }
        : null;
    },
  };

  const imapPort = mailbox.imapPort || 993;
  const syncer = new MailboxSyncer(
    {
      host: mailbox.imapHost,
      port: imapPort,
      secure: imapPort === 993 || imapPort === 3993,
      auth: {
        user: mailbox.imapUser || mailbox.emailAddress,
        pass: imapPassword,
      },
    },
    mailbox.id,
    mailbox.teamId,
    callbacks
  );

  const result = await syncer.syncFolder("INBOX");

  // Queue new inbound emails for AI processing
  for (const { emailId, teamId } of newInboundEmailIds) {
    await aiQueue.add(`ai-${emailId}`, { emailId, teamId });
  }

  if (newInboundEmailIds.length > 0) {
    console.log(
      `[Sync Worker] Queued ${newInboundEmailIds.length} email(s) for AI processing from ${emailAddress}`
    );
  }

  return result;
}

export function createWorker(aiQueue: Queue) {
  const worker = new Worker<SyncMailboxJob>(
    SYNC_QUEUE_NAME,
    async (job) => {
      console.log(`[Sync Worker] Syncing mailbox ${job.data.emailAddress}...`);
      try {
        const result = await processSyncJob(job, aiQueue);
        console.log(
          `[Sync Worker] Synced ${job.data.emailAddress}: ${result.newEmails} new email(s), ${result.newThreads} new thread(s)`
        );
        if (result.errors.length > 0) {
          console.warn(`[Sync Worker] Errors for ${job.data.emailAddress}:`, result.errors);
        }
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[Sync Worker] Failed to sync ${job.data.emailAddress}:`, errorMessage);

        // Update sync state with error
        await prisma.mailboxSync.upsert({
          where: {
            mailboxId_folderName: {
              mailboxId: job.data.mailboxId,
              folderName: "INBOX",
            },
          },
          update: {
            syncStatus: "error",
            errorMessage,
          },
          create: {
            mailboxId: job.data.mailboxId,
            folderName: "INBOX",
            syncStatus: "error",
            errorMessage,
          },
        });

        throw error;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 3,
    }
  );

  worker.on("completed", (job) => {
    if (job) {
      console.log(`[Sync Worker] Job completed for ${job.data.emailAddress}`);
    }
  });

  worker.on("failed", (job, err) => {
    if (job) {
      console.error(`[Sync Worker] Job failed for ${job.data.emailAddress}:`, err.message);
    }
  });

  return worker;
}
