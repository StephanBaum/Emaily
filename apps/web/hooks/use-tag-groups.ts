"use client";

import { useCallback } from "react";
import { useLocalStorage } from "./use-local-storage";

const GROUP_ORDER_KEY = "tag-group-order";
const COLLAPSED_GROUPS_KEY = "tag-groups-collapsed";

/** Persisted group ordering. Returns ordered group names and a setter. */
export function useGroupOrder() {
  const [order, setOrder] = useLocalStorage<string[]>(GROUP_ORDER_KEY, []);

  /** Sort group names according to stored order. Unknown groups go at the end alphabetically. */
  const sortGroups = useCallback(
    (groupNames: string[]) => {
      return [...groupNames].sort((a, b) => {
        const ai = order.indexOf(a);
        const bi = order.indexOf(b);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.localeCompare(b);
      });
    },
    [order]
  );

  return { order, setOrder, sortGroups };
}

/** Persisted collapsed/expanded state for tag groups in sidebar and tag manager. */
export function useCollapsedGroups() {
  const [collapsed, setCollapsed] = useLocalStorage<string[]>(
    COLLAPSED_GROUPS_KEY,
    []
  );

  const isCollapsed = useCallback(
    (group: string) => collapsed.includes(group),
    [collapsed]
  );

  const toggleGroup = useCallback(
    (group: string) => {
      setCollapsed((prev) =>
        prev.includes(group)
          ? prev.filter((g) => g !== group)
          : [...prev, group]
      );
    },
    [setCollapsed]
  );

  return { isCollapsed, toggleGroup };
}

const TAG_ORDER_KEY = "tag-order-by-group";

/** Persisted tag ordering within groups. Keyed by group name ("" for ungrouped). */
export function useTagOrder() {
  const [orderMap, setOrderMap] = useLocalStorage<Record<string, string[]>>(
    TAG_ORDER_KEY,
    {}
  );

  /** Sort tag IDs according to stored order for a group. Unknown tags go at the end. */
  const sortTags = useCallback(
    <T extends { id: string; name: string }>(
      groupKey: string,
      tags: T[]
    ): T[] => {
      const order = orderMap[groupKey];
      if (!order || order.length === 0) return tags;

      return [...tags].sort((a, b) => {
        const ai = order.indexOf(a.id);
        const bi = order.indexOf(b.id);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.name.localeCompare(b.name);
      });
    },
    [orderMap]
  );

  const setTagOrder = useCallback(
    (groupKey: string, tagIds: string[]) => {
      setOrderMap((prev) => ({ ...prev, [groupKey]: tagIds }));
    },
    [setOrderMap]
  );

  return { sortTags, setTagOrder };
}
