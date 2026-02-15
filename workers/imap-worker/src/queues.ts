import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";
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

export function getRedisConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
  };
}

export function createImapQueue() {
  return new Queue<ImapOperationJob | BatchImapOperationJob>(IMAP_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 200 },
    },
  });
}
