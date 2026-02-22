import { mutate } from "swr";

/**
 * Invalidate all thread-related SWR caches.
 * Call after any thread mutation (status, delete, tag changes).
 * Returns a promise that resolves when revalidation completes.
 */
export async function invalidateThreadCaches(): Promise<void> {
  await Promise.all([
    mutate((key) => typeof key === "string" && key.startsWith("/api/threads")),
    mutate("/api/mailboxes"),
    mutate("/api/nudges"),
    mutate("/api/ai/summary"),
  ]);
}
