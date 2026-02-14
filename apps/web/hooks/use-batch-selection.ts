"use client";

import { useState, useCallback, useMemo } from "react";
import { useSWRConfig } from "swr";
import { useRouter } from "next/navigation";

export interface BatchSelectionState {
  selectedIds: Set<string>;
  isSelectionMode: boolean;
}

export function useBatchSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const { mutate } = useSWRConfig();
  const router = useRouter();

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

  // Batch actions
  const batchUpdateStatus = useCallback(
    async (status: string) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;

      // Optimistic update
      mutate(
        (key) => typeof key === "string" && key.startsWith("/api/threads"),
        (currentData: { threads?: { id: string; status: string }[] } | undefined) => {
          if (!currentData?.threads) return currentData;
          return {
            ...currentData,
            threads: currentData.threads.map((thread) =>
              ids.includes(thread.id) ? { ...thread, status } : thread
            ),
          };
        },
        { revalidate: false }
      );

      clearSelection();

      // Sync with server
      try {
        await fetch("/api/threads/batch/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadIds: ids, status }),
        });

        mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
        router.refresh();
      } catch (error) {
        mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
        router.refresh();
        console.error("Batch status update failed:", error);
      }
    },
    [selectedIds, mutate, clearSelection, router]
  );

  const batchDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    // Optimistic update - remove from list
    mutate(
      (key) => typeof key === "string" && key.startsWith("/api/threads"),
      (currentData: { threads?: { id: string }[] } | undefined) => {
        if (!currentData?.threads) return currentData;
        return {
          ...currentData,
          threads: currentData.threads.filter((thread) => !ids.includes(thread.id)),
        };
      },
      { revalidate: false }
    );

    clearSelection();

    // Sync with server
    try {
      await fetch("/api/threads/batch/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadIds: ids }),
      });

      mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
      router.refresh();
    } catch (error) {
      mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
      router.refresh();
      console.error("Batch delete failed:", error);
    }
  }, [selectedIds, mutate, clearSelection, router]);

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
