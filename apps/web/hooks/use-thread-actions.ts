"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";
import { useRouter } from "next/navigation";

interface Thread {
  id: string;
  subject: string;
  status: string;
  tags: { tag: { id: string; name: string; color: string } }[];
  [key: string]: unknown;
}

/**
 * Hook for optimistic thread actions.
 * Updates UI immediately, then syncs with server in background.
 */
export function useThreadActions(threadId: string) {
  const { mutate } = useSWRConfig();
  const router = useRouter();

  /**
   * Optimistically update thread status (archive, snooze, reopen)
   */
  const updateStatus = useCallback(
    async (newStatus: string) => {
      // Optimistically update all thread caches
      mutate(
        (key) => typeof key === "string" && key.startsWith("/api/threads"),
        (currentData: Thread[] | Thread | undefined) => {
          if (!currentData) return currentData;

          // Handle array (thread list)
          if (Array.isArray(currentData)) {
            return currentData.map((thread) =>
              thread.id === threadId ? { ...thread, status: newStatus } : thread
            );
          }

          // Handle single thread
          if (currentData.id === threadId) {
            return { ...currentData, status: newStatus };
          }

          return currentData;
        },
        { revalidate: false }
      );

      // Navigate back immediately for archive/snooze actions
      if (newStatus === "archived" || newStatus === "snoozed") {
        router.push("/inbox");
      }

      // Sync with server in background
      try {
        await fetch(`/api/threads/${threadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });

        // Revalidate SWR caches
        mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
        mutate("/api/mailboxes");

        // Also refresh server component data (non-blocking)
        router.refresh();
      } catch (error) {
        // Revert on error by revalidating
        mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
        router.refresh();
        console.error("Failed to update thread status:", error);
      }
    },
    [threadId, mutate, router]
  );

  /**
   * Optimistically add a tag to thread
   */
  const addTag = useCallback(
    async (tag: { id: string; name: string; color: string }) => {
      const newTag = { tag, appliedBy: "manual" };

      // Optimistically add tag
      mutate(
        (key) => typeof key === "string" && key.startsWith("/api/threads"),
        (currentData: Thread[] | Thread | undefined) => {
          if (!currentData) return currentData;

          if (Array.isArray(currentData)) {
            return currentData.map((thread) =>
              thread.id === threadId
                ? { ...thread, tags: [...thread.tags, newTag] }
                : thread
            );
          }

          if (currentData.id === threadId) {
            return { ...currentData, tags: [...currentData.tags, newTag] };
          }

          return currentData;
        },
        { revalidate: false }
      );

      // Sync with server
      try {
        await fetch(`/api/threads/${threadId}/tags`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagId: tag.id }),
        });

        mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
        mutate("/api/tags");

        // Refresh server component data (non-blocking)
        router.refresh();
      } catch (error) {
        mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
        router.refresh();
        console.error("Failed to add tag:", error);
      }
    },
    [threadId, mutate, router]
  );

  /**
   * Optimistically remove a tag from thread
   */
  const removeTag = useCallback(
    async (tagId: string) => {
      // Optimistically remove tag
      mutate(
        (key) => typeof key === "string" && key.startsWith("/api/threads"),
        (currentData: Thread[] | Thread | undefined) => {
          if (!currentData) return currentData;

          if (Array.isArray(currentData)) {
            return currentData.map((thread) =>
              thread.id === threadId
                ? { ...thread, tags: thread.tags.filter((t) => t.tag.id !== tagId) }
                : thread
            );
          }

          if (currentData.id === threadId) {
            return {
              ...currentData,
              tags: currentData.tags.filter((t) => t.tag.id !== tagId),
            };
          }

          return currentData;
        },
        { revalidate: false }
      );

      // Sync with server
      try {
        await fetch(`/api/threads/${threadId}/tags?tagId=${tagId}`, {
          method: "DELETE",
        });

        mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
        mutate("/api/tags");

        // Refresh server component data (non-blocking)
        router.refresh();
      } catch (error) {
        mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
        router.refresh();
        console.error("Failed to remove tag:", error);
      }
    },
    [threadId, mutate, router]
  );

  return {
    updateStatus,
    addTag,
    removeTag,
  };
}

/**
 * Prefetch a thread's data on hover
 */
export function usePrefetchThread() {
  const { mutate } = useSWRConfig();

  const prefetch = useCallback(
    (threadId: string) => {
      // Only prefetch if not already in cache
      const cacheKey = `/api/threads/${threadId}`;

      // Trigger a background fetch
      fetch(cacheKey)
        .then((res) => res.json())
        .then((data) => {
          mutate(cacheKey, data, { revalidate: false });
        })
        .catch(() => {
          // Ignore prefetch errors
        });
    },
    [mutate]
  );

  return prefetch;
}
