import { createWorker } from "./processor";

console.log("[AI Worker] Starting...");

const worker = createWorker();

async function shutdown() {
  console.log("[AI Worker] Shutting down...");
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("[AI Worker] Ready and listening for jobs");
