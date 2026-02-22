// Load environment variables from the web app's .env.local
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../../../apps/web/.env.local") });
config({ path: resolve(__dirname, "../../../.env") });
config({ path: resolve(__dirname, "../../../.env.local") });

import { Queue } from "bullmq";
import { createSyncQueue, getRedisConnection } from "./queues";
import { createWorker } from "./processor";
import { scheduleAllMailboxes } from "./scheduler";

const AI_QUEUE_NAME = "ai-processing";
const RESCHEDULE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

console.log("[Sync Worker] Starting...");
console.log("[Sync Worker] Encryption key loaded:", !!process.env.ENCRYPTION_KEY);

const syncQueue = createSyncQueue();
const aiQueue = new Queue(AI_QUEUE_NAME, { connection: getRedisConnection() });
const worker = createWorker(aiQueue);

let rescheduleTimer: ReturnType<typeof setInterval> | null = null;

async function start() {
  // Schedule all mailboxes on startup
  await scheduleAllMailboxes(syncQueue);

  // Re-scan for new/deleted mailboxes every 10 minutes
  rescheduleTimer = setInterval(async () => {
    try {
      await scheduleAllMailboxes(syncQueue);
    } catch (error) {
      console.error("[Sync Worker] Failed to reschedule mailboxes:", error);
    }
  }, RESCHEDULE_INTERVAL_MS);
}

async function shutdown() {
  console.log("[Sync Worker] Shutting down...");
  if (rescheduleTimer) {
    clearInterval(rescheduleTimer);
  }
  await worker.close();
  await syncQueue.close();
  await aiQueue.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

start()
  .then(() => {
    console.log("[Sync Worker] Ready and listening for jobs");
  })
  .catch((error) => {
    console.error("[Sync Worker] Failed to start:", error);
    process.exit(1);
  });
