import { Queue } from "bullmq";
import type { ImapOperationType } from "@emaily/shared";

export const IMAP_QUEUE_NAME = "imap-operations";

export interface ImapOperationJob {
  operationId: string;
  mailboxId: string;
  operation: ImapOperationType;
  folder: string;
  imapUid?: number;
  payload: Record<string, unknown>;
}

export interface BatchImapOperationJob {
  operationIds: string[];
  mailboxId: string;
  operation: ImapOperationType;
  folder: string;
  imapUids: number[];
  payload: Record<string, unknown>;
}

function getRedisConnection() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
  };
}

let imapQueue: Queue<ImapOperationJob | BatchImapOperationJob> | null = null;

function getImapQueue(): Queue<ImapOperationJob | BatchImapOperationJob> {
  if (!imapQueue) {
    imapQueue = new Queue<ImapOperationJob | BatchImapOperationJob>(
      IMAP_QUEUE_NAME,
      {
        connection: getRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: { count: 500 },
          removeOnFail: { count: 200 },
        },
      }
    );
  }
  return imapQueue;
}

/**
 * Queue a single IMAP operation
 */
export async function queueImapOperation(
  operationId: string,
  mailboxId: string,
  operation: ImapOperationType,
  folder: string,
  imapUid?: number,
  payload: Record<string, unknown> = {}
): Promise<void> {
  const queue = getImapQueue();
  await queue.add(
    `${operation}-${operationId}`,
    {
      operationId,
      mailboxId,
      operation,
      folder,
      imapUid,
      payload,
    } as ImapOperationJob,
    {
      priority: getPriority(operation),
    }
  );
}

/**
 * Queue a batch of IMAP operations (same operation type)
 */
export async function queueBatchImapOperation(
  operationIds: string[],
  mailboxId: string,
  operation: ImapOperationType,
  folder: string,
  imapUids: number[],
  payload: Record<string, unknown> = {}
): Promise<void> {
  const queue = getImapQueue();
  await queue.add(
    `batch-${operation}-${Date.now()}`,
    {
      operationIds,
      mailboxId,
      operation,
      folder,
      imapUids,
      payload,
    } as BatchImapOperationJob,
    {
      priority: getPriority(operation),
    }
  );
}

/**
 * Check IMAP queue connection health
 */
export async function checkImapQueueHealth(): Promise<{
  connected: boolean;
  pendingJobs: number;
  failedJobs: number;
}> {
  try {
    const queue = getImapQueue();
    const [waiting, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getFailedCount(),
    ]);
    return {
      connected: true,
      pendingJobs: waiting,
      failedJobs: failed,
    };
  } catch {
    return {
      connected: false,
      pendingJobs: 0,
      failedJobs: 0,
    };
  }
}

function getPriority(operation: ImapOperationType): number {
  // Lower number = higher priority
  switch (operation) {
    case "mark_read":
    case "mark_unread":
      return 1; // Highest - user is viewing
    case "move_to_archive":
    case "move_to_inbox":
      return 2;
    case "move_to_trash":
      return 3;
    case "add_flag":
    case "remove_flag":
      return 4;
    case "expunge":
      return 5; // Lowest - permanent actions
    default:
      return 3;
  }
}

/**
 * Close the queue connection (for cleanup)
 */
export async function closeImapQueue(): Promise<void> {
  if (imapQueue) {
    await imapQueue.close();
    imapQueue = null;
  }
}
