"use client";

import useSWR from "swr";
import { fetcher, stableConfig } from "@/lib/swr-config";

export interface TagData {
  id: string;
  name: string;
  color: string;
  aiAction: string;
  tagGroup: string | null;
  active: boolean;
  _count: {
    threads: number;
  };
}

// Tags are Redis-cached for 30s and stableConfig (60s poll) is adequate.
// Removed revalidateOnFocus override to prevent request storms on tab switches.

export function useTags() {
  const { data, error, isLoading, mutate } = useSWR<TagData[]>(
    "/api/tags",
    fetcher<TagData[]>,
    stableConfig
  );

  return {
    tags: data,
    isLoading,
    isError: error,
    mutate,
  };
}
