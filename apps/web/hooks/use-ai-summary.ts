"use client";

import useSWR from "swr";
import { fetcher, realtimeConfig } from "@/lib/swr-config";
import type { AISummaryResponse } from "@emaily/shared";

export function useAISummary(params?: { hours?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.hours) searchParams.set("hours", params.hours.toString());

  const url = `/api/ai/summary${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<AISummaryResponse>(
    url,
    fetcher<AISummaryResponse>,
    realtimeConfig
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
