import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../../../.env.local") });

import { createWorker } from "./processor";

console.log("[IMAP Worker] Starting...");
console.log("[IMAP Worker] Encryption key loaded:", !!process.env.ENCRYPTION_KEY);

const worker = createWorker();

async function shutdown() {
  console.log("[IMAP Worker] Shutting down...");
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("[IMAP Worker] Ready and listening for jobs");
