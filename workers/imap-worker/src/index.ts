// Load environment variables from the web app's .env.local
import { config } from "dotenv";
import { resolve } from "path";

// Try loading from web app first, then root
config({ path: resolve(__dirname, "../../../apps/web/.env.local") });
config({ path: resolve(__dirname, "../../../.env") });
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
