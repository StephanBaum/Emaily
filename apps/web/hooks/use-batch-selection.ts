"use client";

import { useState, useCallback, useMemo } from "react";
import { useThreadUpdates } from "@/contexts/thread-updates-context";
import { REVALIDATION_DELAY_MS } from "@/lib/constants";
import { invalidateThreadCaches } from "@/lib/cache-utils";

export interface BatchSelectionState {
  selectedIds: Set<string>;
  isSelectionMode: boolean;
}

export function useBatchSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const { markStatusChange, markDeleted, clearUpdate } = useThreadUpdates();

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

  // Batch actions with instant UI updates via context
  const batchUpdateStatus = useCallback(
    async (status: string) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;

      // Instantly mark all threads for hiding via context
      ids.forEach((id) => markStatusChange(id, status));

      clearSelection();

      // Sync with server
      try {
        const res = await fetch("/api/threads/batch/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadIds: ids, status }),
        });

        if (!res.ok) throw new Error("Failed to update");

        // Revalidate caches
        invalidateThreadCaches();

        // Clear pending updates after revalidation
        setTimeout(() => ids.forEach((id) => clearUpdate(id)), REVALIDATION_DELAY_MS);
      } catch (error) {
        // Revert on error
        ids.forEach((id) => clearUpdate(id));
        console.error("Batch status update failed:", error);
      }
    },
    [selectedIds, markStatusChange, clearSelection, clearUpdate]
  );

  const batchDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    // Instantly mark all as deleted via context
    ids.forEach((id) => markDeleted(id));

    clearSelection();

    // Sync with server
    try {
      const res = await fetch("/api/threads/batch/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadIds: ids }),
      });

      if (!res.ok) throw new Error("Failed to delete");

      // Revalidate caches
      invalidateThreadCaches();

      // Clear pending updates after revalidation
      setTimeout(() => ids.forEach((id) => clearUpdate(id)), REVALIDATION_DELAY_MS);
    } catch (error) {
      // Revert on error
      ids.forEach((id) => clearUpdate(id));
      console.error("Batch delete failed:", error);
    }
  }, [selectedIds, markDeleted, clearSelection, clearUpdate]);

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
