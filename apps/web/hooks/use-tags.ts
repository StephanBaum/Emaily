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

// Tags change moderately but counts change frequently (tag/untag, archive, etc.)
// Override stableConfig to revalidate on focus so counts refresh when user returns.
const tagsConfig = {
  ...stableConfig,
  revalidateOnFocus: true,
};

export function useTags() {
  const { data, error, isLoading, mutate } = useSWR<TagData[]>(
    "/api/tags",
    fetcher<TagData[]>,
    tagsConfig
  );

  return {
    tags: data,
    isLoading,
    isError: error,
    mutate,
  };
}
