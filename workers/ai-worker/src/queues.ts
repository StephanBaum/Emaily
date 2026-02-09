import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";

export const AI_QUEUE_NAME = "ai-processing";

export interface ProcessEmailJob {
  emailId: string;
  teamId: string;
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

export function createAIQueue() {
  return new Queue<ProcessEmailJob>(AI_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
    },
  });
}
