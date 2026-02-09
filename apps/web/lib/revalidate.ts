import { mutate } from "swr";

/**
 * Revalidate all SWR caches matching /api/* keys.
 * Use after major operations like sync or bulk AI processing.
 */
export function revalidateAll() {
  mutate(
    (key) => typeof key === "string" && key.startsWith("/api/"),
    undefined,
    { revalidate: true }
  );
}

/** Revalidate all thread list and single-thread SWR caches. */
export function revalidateThreads() {
  mutate(
    (key) => typeof key === "string" && key.startsWith("/api/threads"),
    undefined,
    { revalidate: true }
  );
}

/** Revalidate tag list SWR cache. */
export function revalidateTags() {
  mutate("/api/tags");
}

/** Revalidate mailbox list SWR cache. */
export function revalidateMailboxes() {
  mutate("/api/mailboxes");
}
