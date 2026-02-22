"use client";

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
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
 * Hook for thread actions with proper optimistic updates.
 * Uses the ThreadUpdatesContext for instant UI updates.
 */
export function useOptimisticThreadActions(threadId: string) {
  const { markStatusChange, markDeleted, clearUpdate } = useThreadUpdates();

  const updateStatus = useCallback(
    async (newStatus: string) => {
      // Instantly mark thread for hiding/update
      markStatusChange(threadId, newStatus);

      try {
        const res = await fetch(`/api/threads/${threadId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!res.ok) {
          throw new Error("Failed to update status");
        }

        // Revalidate caches and wait for fresh data before clearing the optimistic update
        await invalidateThreadCaches();
        clearUpdate(threadId);
      } catch (error) {
        // Revert on error
        clearUpdate(threadId);
        console.error("Failed to update thread status:", error);
        throw error;
      }
    },
    [threadId, markStatusChange, clearUpdate]
  );

  const deleteThread = useCallback(async () => {
    // Instantly mark as deleted
    markDeleted(threadId);

    try {
      const res = await fetch(`/api/threads/${threadId}/delete`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete thread");
      }

      // Revalidate caches and wait for fresh data before clearing the optimistic update
      await invalidateThreadCaches();
      clearUpdate(threadId);
    } catch (error) {
      clearUpdate(threadId);
      console.error("Failed to delete thread:", error);
      throw error;
    }
  }, [threadId, markDeleted, clearUpdate]);

  return { updateStatus, deleteThread };
}
