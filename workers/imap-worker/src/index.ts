import { createWorker } from "./processor";

console.log("[IMAP Worker] Starting...");

const worker = createWorker();

async function shutdown() {
  console.log("[IMAP Worker] Shutting down...");
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("[IMAP Worker] Ready and listening for jobs");
