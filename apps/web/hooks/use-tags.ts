"use client";

import useSWR from "swr";

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

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to fetch tags");
  }
  return res.json();
}

export function useTags() {
  const { data, error, isLoading, mutate } = useSWR<TagData[]>(
    "/api/tags",
    fetcher,
    { refreshInterval: 15000, revalidateOnFocus: true }
  );

  return {
    tags: data,
    isLoading,
    isError: error,
    mutate,
  };
}
