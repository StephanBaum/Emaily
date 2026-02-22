"use client";

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import { useSWRConfig } from "swr";
import { invalidateThreadCaches } from "@/lib/cache-utils";

interface ThreadUpdate {
  id: string;
  action: "status_change" | "delete";
  newStatus?: string;
  timestamp: number;
}

interface ThreadUpdatesContextValue {
  // Pending updates that haven't been confirmed by server
  pendingUpdates: Map<string, ThreadUpdate>;

  // Mark a thread as having a pending status change
  markStatusChange: (threadId: string, newStatus: string) => void;

  // Mark a thread as pending deletion
  markDeleted: (threadId: string) => void;

  // Clear a pending update (called after server confirms)
  clearUpdate: (threadId: string) => void;

  // Clear all pending updates
  clearAllUpdates: () => void;

  // Check if a thread should be hidden from a specific view
  shouldHideThread: (threadId: string, viewStatus: string | null) => boolean;

  // Get the effective status of a thread (pending or actual)
  getEffectiveStatus: (threadId: string, actualStatus: string) => string;
}

const ThreadUpdatesContext = createContext<ThreadUpdatesContextValue | null>(null);

export function ThreadUpdatesProvider({ children }: { children: ReactNode }) {
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, ThreadUpdate>>(new Map());

  const markStatusChange = useCallback((threadId: string, newStatus: string) => {
    setPendingUpdates((prev) => {
      const next = new Map(prev);
      next.set(threadId, {
        id: threadId,
        action: "status_change",
        newStatus,
        timestamp: Date.now(),
      });
      return next;
    });
  }, []);

  const markDeleted = useCallback((threadId: string) => {
    setPendingUpdates((prev) => {
      const next = new Map(prev);
      next.set(threadId, {
        id: threadId,
        action: "delete",
        timestamp: Date.now(),
      });
      return next;
    });
  }, []);

  const clearUpdate = useCallback((threadId: string) => {
    setPendingUpdates((prev) => {
      const next = new Map(prev);
      next.delete(threadId);
      return next;
    });
  }, []);

  const clearAllUpdates = useCallback(() => {
    setPendingUpdates(new Map());
  }, []);

  const shouldHideThread = useCallback(
    (threadId: string, viewStatus: string | null): boolean => {
      const update = pendingUpdates.get(threadId);
      if (!update) return false;

      // Always hide deleted threads
      if (update.action === "delete") return true;

      // For status changes, hide if the new status doesn't match the view
      if (update.action === "status_change" && update.newStatus) {
        // If no view status filter, don't hide
        if (!viewStatus || viewStatus === "all") return false;

        // Hide if new status doesn't match view
        return update.newStatus !== viewStatus;
      }

      return false;
    },
    [pendingUpdates]
  );

  const getEffectiveStatus = useCallback(
    (threadId: string, actualStatus: string): string => {
      const update = pendingUpdates.get(threadId);
      if (update?.action === "status_change" && update.newStatus) {
        return update.newStatus;
      }
      return actualStatus;
    },
    [pendingUpdates]
  );

  const value = useMemo(
    () => ({
      pendingUpdates,
      markStatusChange,
      markDeleted,
      clearUpdate,
      clearAllUpdates,
      shouldHideThread,
      getEffectiveStatus,
    }),
    [pendingUpdates, markStatusChange, markDeleted, clearUpdate, clearAllUpdates, shouldHideThread, getEffectiveStatus]
  );

  return (
    <ThreadUpdatesContext.Provider value={value}>
      {children}
    </ThreadUpdatesContext.Provider>
  );
}

export function useThreadUpdates() {
  const context = useContext(ThreadUpdatesContext);
  if (!context) {
    throw new Error("useThreadUpdates must be used within ThreadUpdatesProvider");
  }
  return context;
}

/**
 * Optimistically remove a thread from all SWR list caches.
 * Uses { revalidate: false } so the cache stays in the optimistic state
 * until an explicit revalidation is triggered.
 */
interface TagInfo {
  id: string;
  name: string;
  color: string;
}

function useOptimisticCacheMutations() {
  const { mutate } = useSWRConfig();

  /** Remove threads from all SWR list caches */
  const removeThreadsFromCache = useCallback(
    (threadIds: string[]) => {
      const idSet = new Set(threadIds);
      mutate(
        (key) => typeof key === "string" && key.startsWith("/api/threads"),
        (currentData: any) => {
          if (!currentData) return currentData;
          if ("threads" in currentData && Array.isArray(currentData.threads)) {
            return {
              ...currentData,
              threads: currentData.threads.filter(
                        (t: any) => !idSet.has(t.id)
              ),
            };
          }
          return currentData;
        },
        { revalidate: false }
      );
    },
    [mutate]
  );

  /** Optimistically add a tag to a thread in all SWR caches */
  const addTagToCache = useCallback(
    (threadId: string, tag: TagInfo) => {
      const newTag = { tag, appliedBy: "manual" };
      mutate(
        (key) => typeof key === "string" && key.startsWith("/api/threads"),
        (currentData: any) => {
          if (!currentData) return currentData;
          if ("threads" in currentData && Array.isArray(currentData.threads)) {
            return {
              ...currentData,
                    threads: currentData.threads.map((t: any) =>
                t.id === threadId ? { ...t, tags: [...t.tags, newTag] } : t
              ),
            };
          }
          if ("id" in currentData && currentData.id === threadId) {
            return { ...currentData, tags: [...currentData.tags, newTag] };
          }
          return currentData;
        },
        { revalidate: false }
      );
    },
    [mutate]
  );

  /** Optimistically remove a tag from a thread in all SWR caches */
  const removeTagFromCache = useCallback(
    (threadId: string, tagId: string) => {
      mutate(
        (key) => typeof key === "string" && key.startsWith("/api/threads"),
        (currentData: any) => {
          if (!currentData) return currentData;
          if ("threads" in currentData && Array.isArray(currentData.threads)) {
            return {
              ...currentData,
                    threads: currentData.threads.map((t: any) =>
                t.id === threadId
                            ? { ...t, tags: t.tags.filter((tt: any) => tt.tag.id !== tagId) }
                  : t
              ),
            };
          }
          if ("id" in currentData && currentData.id === threadId) {
                return { ...currentData, tags: currentData.tags.filter((tt: any) => tt.tag.id !== tagId) };
          }
          return currentData;
        },
        { revalidate: false }
      );
    },
    [mutate]
  );

  /** Force revalidation to restore correct data on error */
  const revertCache = useCallback(() => {
    mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
    mutate("/api/mailboxes");
    mutate("/api/tags");
  }, [mutate]);

  return { removeThreadsFromCache, addTagToCache, removeTagFromCache, revertCache };
}

/**
 * Hook for thread actions with proper optimistic updates.
 * Combines context-based hiding (instant cross-component awareness)
 * with direct SWR cache mutations (data consistency).
 */
export function useOptimisticThreadActions(threadId: string) {
  const { markStatusChange, markDeleted, clearUpdate } = useThreadUpdates();
  const { removeThreadsFromCache, addTagToCache, removeTagFromCache, revertCache } =
    useOptimisticCacheMutations();

  const updateStatus = useCallback(
    async (newStatus: string) => {
      markStatusChange(threadId, newStatus);
      removeThreadsFromCache([threadId]);

      try {
        const res = await fetch(`/api/threads/${threadId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!res.ok) throw new Error("Failed to update status");

        invalidateThreadCaches();
        clearUpdate(threadId);
      } catch (error) {
        clearUpdate(threadId);
        revertCache();
        console.error("Failed to update thread status:", error);
        throw error;
      }
    },
    [threadId, markStatusChange, clearUpdate, removeThreadsFromCache, revertCache]
  );

  const deleteThread = useCallback(async () => {
    markDeleted(threadId);
    removeThreadsFromCache([threadId]);

    try {
      const res = await fetch(`/api/threads/${threadId}/delete`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete thread");

      invalidateThreadCaches();
      clearUpdate(threadId);
    } catch (error) {
      clearUpdate(threadId);
      revertCache();
      console.error("Failed to delete thread:", error);
      throw error;
    }
  }, [threadId, markDeleted, clearUpdate, removeThreadsFromCache, revertCache]);

  const addTag = useCallback(
    async (tag: TagInfo) => {
      addTagToCache(threadId, tag);

      try {
        await fetch(`/api/threads/${threadId}/tags`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagId: tag.id }),
        });

        invalidateThreadCaches();
      } catch (error) {
        revertCache();
        console.error("Failed to add tag:", error);
        throw error;
      }
    },
    [threadId, addTagToCache, revertCache]
  );

  const removeTag = useCallback(
    async (tagId: string) => {
      removeTagFromCache(threadId, tagId);

      try {
        await fetch(`/api/threads/${threadId}/tags?tagId=${tagId}`, {
          method: "DELETE",
        });

        invalidateThreadCaches();
      } catch (error) {
        revertCache();
        console.error("Failed to remove tag:", error);
        throw error;
      }
    },
    [threadId, removeTagFromCache, revertCache]
  );

  return { updateStatus, deleteThread, addTag, removeTag };
}
