"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";

/**
 * Prefetch a thread's data on hover for instant navigation.
 */
export function usePrefetchThread() {
  const { mutate } = useSWRConfig();

  const prefetch = useCallback(
    (threadId: string) => {
      const cacheKey = `/api/threads/${threadId}`;

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
