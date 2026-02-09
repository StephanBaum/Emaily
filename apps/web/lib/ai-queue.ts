import { Queue } from "bullmq";

const AI_QUEUE_NAME = "ai-processing";

interface ProcessEmailJob {
  emailId: string;
  teamId: string;
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

let queue: Queue<ProcessEmailJob> | null = null;

function getQueue(): Queue<ProcessEmailJob> {
  if (!queue) {
    queue = new Queue<ProcessEmailJob>(AI_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return queue;
}

export async function enqueueEmailForAI(emailId: string, teamId: string) {
  const q = getQueue();
  await q.add("process_email", { emailId, teamId }, {
    jobId: `ai-${emailId}`,
  });
}
