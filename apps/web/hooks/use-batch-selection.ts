"use client";

import { useState, useCallback, useMemo } from "react";
import { useSWRConfig } from "swr";
import { useThreadUpdates } from "@/contexts/thread-updates-context";
import { invalidateThreadCaches } from "@/lib/cache-utils";

export interface BatchSelectionState {
  selectedIds: Set<string>;
  isSelectionMode: boolean;
}

export function useBatchSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const { markStatusChange, markDeleted, clearUpdate } = useThreadUpdates();
  const { mutate } = useSWRConfig();

  const toggleSelection = useCallback((threadId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      // Auto-enter selection mode when first item is selected
      if (next.size > 0) {
        setIsSelectionMode(true);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((threadIds: string[]) => {
    setSelectedIds(new Set(threadIds));
    if (threadIds.length > 0) {
      setIsSelectionMode(true);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  }, []);

  const isSelected = useCallback(
    (threadId: string) => selectedIds.has(threadId),
    [selectedIds]
  );

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  /** Optimistically remove threads from all SWR list caches */
  const removeFromCache = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      mutate(
        (key) => typeof key === "string" && key.startsWith("/api/threads"),
        (currentData: any) => {
          if (!currentData) return currentData;
          if ("threads" in currentData && Array.isArray(currentData.threads)) {
            return {
              ...currentData,
                    threads: currentData.threads.filter((t: any) => !idSet.has(t.id)),
            };
          }
          return currentData;
        },
        { revalidate: false }
      );
    },
    [mutate]
  );

  // Batch actions with instant UI updates via context + SWR cache
  const batchUpdateStatus = useCallback(
    async (status: string) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;

      // 1. Context: mark all for hiding
      ids.forEach((id) => markStatusChange(id, status));
      // 2. SWR: remove from list caches
      removeFromCache(ids);

      clearSelection();

      // Sync with server
      try {
        const res = await fetch("/api/threads/batch/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadIds: ids, status }),
        });

        if (!res.ok) throw new Error("Failed to update");

        // Background revalidation
        invalidateThreadCaches();
        ids.forEach((id) => clearUpdate(id));
      } catch (error) {
        // Revert
        ids.forEach((id) => clearUpdate(id));
        mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
        console.error("Batch status update failed:", error);
      }
    },
    [selectedIds, markStatusChange, clearSelection, clearUpdate, removeFromCache, mutate]
  );

  const batchDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    // 1. Context: mark all as deleted
    ids.forEach((id) => markDeleted(id));
    // 2. SWR: remove from list caches
    removeFromCache(ids);

    clearSelection();

    // Sync with server
    try {
      const res = await fetch("/api/threads/batch/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadIds: ids }),
      });

      if (!res.ok) throw new Error("Failed to delete");

      // Background revalidation
      invalidateThreadCaches();
      ids.forEach((id) => clearUpdate(id));
    } catch (error) {
      // Revert
      ids.forEach((id) => clearUpdate(id));
      mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
      console.error("Batch delete failed:", error);
    }
  }, [selectedIds, markDeleted, clearSelection, clearUpdate, removeFromCache, mutate]);

  return {
    selectedIds,
    selectedCount,
    isSelectionMode,
    setIsSelectionMode,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    batchUpdateStatus,
    batchDelete,
  };
}
