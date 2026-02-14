import { mutate } from "swr";

/**
 * Invalidate all thread-related SWR caches.
 * Call after any thread mutation (status, delete, tag changes).
 */
export function invalidateThreadCaches(): void {
  mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
  mutate("/api/mailboxes");
  mutate("/api/nudges");
  mutate("/api/ai/summary");
}

/**
 * Invalidate thread caches after a delay (for optimistic updates).
 */
export function invalidateThreadCachesDelayed(delayMs: number): void {
  setTimeout(() => invalidateThreadCaches(), delayMs);
}
