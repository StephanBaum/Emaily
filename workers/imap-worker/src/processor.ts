import { Worker, Job } from "bullmq";
import { prisma } from "@emaily/database";
import { ImapClient, ImapConfig } from "@emaily/mail-engine";
import { decrypt } from "@emaily/security";
import {
  IMAP_QUEUE_NAME,
  getRedisConnection,
  ImapOperationJob,
  BatchImapOperationJob,
} from "./queues";

const MASTER_KEY = process.env.ENCRYPTION_KEY || "dev-key-change-in-production";

interface MailboxWithFolders {
  id: string;
  imapHost: string | null;
  imapPort: number | null;
  imapUser: string | null;
  imapPasswordEnc: string | null;
  folderInbox: string;
  folderArchive: string;
  folderTrash: string;
  folderDrafts: string;
  folderSent: string;
  folderSpam: string;
}

async function getMailboxConfig(
  mailboxId: string
): Promise<{ config: ImapConfig; folders: MailboxWithFolders } | null> {
  const mailbox = await prisma.mailbox.findUnique({
    where: { id: mailboxId },
    select: {
      id: true,
      imapHost: true,
      imapPort: true,
      imapUser: true,
      imapPasswordEnc: true,
      folderInbox: true,
      folderArchive: true,
      folderTrash: true,
      folderDrafts: true,
      folderSent: true,
      folderSpam: true,
    },
  });

  if (!mailbox?.imapHost || !mailbox.imapUser || !mailbox.imapPasswordEnc) {
    return null;
  }

  const password = decrypt(mailbox.imapPasswordEnc, MASTER_KEY);

  return {
    config: {
      host: mailbox.imapHost,
      port: mailbox.imapPort || 993,
      secure: true,
      auth: {
        user: mailbox.imapUser,
        pass: password,
      },
    },
    folders: mailbox,
  };
}

async function processOperation(
  client: ImapClient,
  job: ImapOperationJob,
  folders: MailboxWithFolders
): Promise<void> {
  const { operation, folder, imapUid, payload } = job;

  switch (operation) {
    case "move_to_trash":
      if (imapUid) {
        await client.moveToTrash(folder, imapUid, folders.folderTrash);
      }
      break;

    case "move_to_archive":
      if (imapUid) {
        await client.moveToArchive(folder, imapUid, folders.folderArchive);
      }
      break;

    case "move_to_inbox":
      if (imapUid) {
        await client.moveEmail(folder, imapUid, folders.folderInbox);
      }
      break;

    case "mark_read":
      if (imapUid) {
        await client.markAsSeen(folder, imapUid);
      }
      break;

    case "mark_unread":
      if (imapUid) {
        await client.markAsUnseen(folder, imapUid);
      }
      break;

    case "add_flag":
      if (imapUid && payload.flags) {
        await client.addFlags(folder, imapUid, payload.flags as string[]);
      }
      break;

    case "remove_flag":
      if (imapUid && payload.flags) {
        await client.removeFlags(folder, imapUid, payload.flags as string[]);
      }
      break;

    case "expunge":
      await client.expunge(folder);
      break;

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

async function processBatchOperation(
  client: ImapClient,
  job: BatchImapOperationJob,
  folders: MailboxWithFolders
): Promise<void> {
  const { operation, folder, imapUids, payload } = job;

  if (imapUids.length === 0) return;

  switch (operation) {
    case "move_to_trash":
      await client.moveEmails(folder, imapUids, folders.folderTrash);
      break;

    case "move_to_archive":
      await client.moveEmails(folder, imapUids, folders.folderArchive);
      break;

    case "move_to_inbox":
      await client.moveEmails(folder, imapUids, folders.folderInbox);
      break;

    case "mark_read":
      await client.addFlagsBatch(folder, imapUids, ["\\Seen"]);
      break;

    case "mark_unread":
      await client.removeFlagsBatch(folder, imapUids, ["\\Seen"]);
      break;

    case "add_flag":
      if (payload.flags) {
        await client.addFlagsBatch(folder, imapUids, payload.flags as string[]);
      }
      break;

    case "remove_flag":
      if (payload.flags) {
        await client.removeFlagsBatch(folder, imapUids, payload.flags as string[]);
      }
      break;

    default:
      throw new Error(`Unknown batch operation: ${operation}`);
  }
}

function isBatchJob(
  job: ImapOperationJob | BatchImapOperationJob
): job is BatchImapOperationJob {
  return "operationIds" in job && Array.isArray(job.operationIds);
}

async function updateOperationStatus(
  operationId: string,
  status: "completed" | "failed",
  error?: string
): Promise<void> {
  await prisma.imapOperation.update({
    where: { id: operationId },
    data: {
      status,
      error: error || null,
      processedAt: new Date(),
      attempts: { increment: 1 },
    },
  });
}

async function updateBatchOperationStatus(
  operationIds: string[],
  status: "completed" | "failed",
  error?: string
): Promise<void> {
  await prisma.imapOperation.updateMany({
    where: { id: { in: operationIds } },
    data: {
      status,
      error: error || null,
      processedAt: new Date(),
    },
  });
}

async function processJob(
  job: Job<ImapOperationJob | BatchImapOperationJob>
): Promise<void> {
  const data = job.data;
  const isBatch = isBatchJob(data);
  const operationIds = isBatch ? data.operationIds : [data.operationId];

  console.log(
    `[IMAP Worker] Processing ${isBatch ? "batch" : "single"} operation: ${data.operation} for mailbox ${data.mailboxId}`
  );

  // Mark as processing
  await prisma.imapOperation.updateMany({
    where: { id: { in: operationIds } },
    data: { status: "processing" },
  });

  // Get mailbox config
  const mailboxData = await getMailboxConfig(data.mailboxId);
  if (!mailboxData) {
    const error = "Mailbox not found or missing IMAP credentials";
    if (isBatch) {
      await updateBatchOperationStatus(operationIds, "failed", error);
    } else {
      await updateOperationStatus(data.operationId, "failed", error);
    }
    throw new Error(error);
  }

  const { config, folders } = mailboxData;
  const client = new ImapClient(config);

  try {
    await client.connect();

    if (isBatch) {
      await processBatchOperation(client, data, folders);
      await updateBatchOperationStatus(operationIds, "completed");
    } else {
      await processOperation(client, data, folders);
      await updateOperationStatus(data.operationId, "completed");
    }

    console.log(
      `[IMAP Worker] Successfully processed ${isBatch ? operationIds.length : 1} operation(s)`
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[IMAP Worker] Error processing operation:`, errorMessage);

    if (isBatch) {
      await updateBatchOperationStatus(operationIds, "failed", errorMessage);
    } else {
      await updateOperationStatus(data.operationId, "failed", errorMessage);
    }

    throw error;
  } finally {
    try {
      await client.disconnect();
    } catch {
      // Ignore disconnect errors
    }
  }
}

export function createWorker(): Worker<ImapOperationJob | BatchImapOperationJob> {
  const worker = new Worker<ImapOperationJob | BatchImapOperationJob>(
    IMAP_QUEUE_NAME,
    processJob,
    {
      connection: getRedisConnection(),
      concurrency: 5, // Process up to 5 jobs concurrently per worker
    }
  );

  worker.on("completed", (job) => {
    console.log(`[IMAP Worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[IMAP Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[IMAP Worker] Worker error:", err);
  });

  return worker;
}
