"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";
import { useRouter } from "next/navigation";

interface ThreadTag {
  tag: { id: string; name: string; color: string };
}

interface Thread {
  id: string;
  subject: string;
  status: string;
  tags: ThreadTag[];
  [key: string]: unknown;
}

interface ThreadsResponse {
  threads: Thread[];
  pagination: {
    hasNextPage: boolean;
    nextCursor: string | null;
    limit: number;
  };
}

type ThreadData = Thread | ThreadsResponse;

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
        (currentData: ThreadData | undefined) => {
          if (!currentData) return currentData;

          // Handle paginated response { threads: [...], pagination: {...} }
          if ("threads" in currentData && Array.isArray(currentData.threads)) {
            return {
              ...currentData,
              threads: currentData.threads.map((thread) =>
                thread.id === threadId ? { ...thread, status: newStatus } : thread
              ),
            };
          }

          // Handle single thread (detail view)
          if ("id" in currentData && currentData.id === threadId) {
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
        await fetch(`/api/threads/${threadId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });

        // Revalidate SWR caches
        mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
        mutate("/api/mailboxes");
        mutate("/api/tags");

        // Also refresh server component data (non-blocking)
        router.refresh();
      } catch (error) {
        // Revert on error by revalidating
        mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
        mutate("/api/tags");
        router.refresh();
        console.error("Failed to update thread status:", error);
      }
    },
    [threadId, mutate, router]
  );

  /**
   * Permanently delete a thread (only works for trashed threads)
   */
  const deleteThread = useCallback(async () => {
    // Optimistically remove from all caches
    mutate(
      (key) => typeof key === "string" && key.startsWith("/api/threads"),
      (currentData: ThreadData | undefined) => {
        if (!currentData) return currentData;

        // Handle paginated response
        if ("threads" in currentData && Array.isArray(currentData.threads)) {
          return {
            ...currentData,
            threads: currentData.threads.filter((thread) => thread.id !== threadId),
          };
        }

        return currentData;
      },
      { revalidate: false }
    );

    // Navigate back immediately
    router.push("/inbox?status=trashed");

    // Sync with server
    try {
      await fetch(`/api/threads/${threadId}/delete`, {
        method: "DELETE",
      });

      mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
      mutate("/api/tags");
      router.refresh();
    } catch (error) {
      mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
      mutate("/api/tags");
      router.refresh();
      console.error("Failed to delete thread:", error);
    }
  }, [threadId, mutate, router]);

  /**
   * Optimistically add a tag to thread
   */
  const addTag = useCallback(
    async (tag: { id: string; name: string; color: string }) => {
      const newTag = { tag, appliedBy: "manual" };

      // Optimistically add tag
      mutate(
        (key) => typeof key === "string" && key.startsWith("/api/threads"),
        (currentData: ThreadData | undefined) => {
          if (!currentData) return currentData;

          // Handle paginated response { threads: [...], pagination: {...} }
          if ("threads" in currentData && Array.isArray(currentData.threads)) {
            return {
              ...currentData,
              threads: currentData.threads.map((thread) =>
                thread.id === threadId
                  ? { ...thread, tags: [...thread.tags, newTag] }
                  : thread
              ),
            };
          }

          // Handle single thread (detail view)
          if ("id" in currentData && currentData.id === threadId) {
            return { ...currentData, tags: [...(currentData as Thread).tags, newTag] };
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
        (currentData: ThreadData | undefined) => {
          if (!currentData) return currentData;

          // Handle paginated response { threads: [...], pagination: {...} }
          if ("threads" in currentData && Array.isArray(currentData.threads)) {
            return {
              ...currentData,
              threads: currentData.threads.map((thread) =>
                thread.id === threadId
                  ? { ...thread, tags: thread.tags.filter((t: ThreadTag) => t.tag.id !== tagId) }
                  : thread
              ),
            };
          }

          // Handle single thread (detail view)
          if ("id" in currentData && currentData.id === threadId) {
            return {
              ...currentData,
              tags: (currentData as Thread).tags.filter((t: ThreadTag) => t.tag.id !== tagId),
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
    deleteThread,
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
