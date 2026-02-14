"use client";

import useSWR from "swr";
import type { AISummaryResponse } from "@emailautomation/shared";

async function fetcher(url: string): Promise<AISummaryResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch AI summary");
  }
  return res.json();
}

export function useAISummary(params?: { hours?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.hours) searchParams.set("hours", params.hours.toString());

  const url = `/api/ai/summary${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<AISummaryResponse>(
    url,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
    }
  );

  return {
    summary: data,
    groups: data?.groups ?? [],
    totalCount: data?.totalCount ?? 0,
    since: data?.since ? new Date(data.since) : null,
    isLoading,
    isError: error,
    mutate,
  };
}
