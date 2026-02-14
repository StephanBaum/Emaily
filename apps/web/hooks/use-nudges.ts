"use client";

import useSWR from "swr";

export interface NudgeThread {
  id: string;
  subject: string;
  senderName: string | null;
  senderEmail: string;
  senderTrustLevel: string | null;
  lastActivityAt: string;
  daysSince: number;
  nudgeType: "needs_reply" | "awaiting_response";
}

interface NudgesResponse {
  needsReply: NudgeThread[];
  awaitingResponse: NudgeThread[];
  totalNudges: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useNudges() {
  const { data, error, mutate } = useSWR<NudgesResponse>(
    "/api/nudges",
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: true,
    }
  );

  return {
    needsReply: data?.needsReply ?? [],
    awaitingResponse: data?.awaitingResponse ?? [],
    totalNudges: data?.totalNudges ?? 0,
    isLoading: !error && !data,
    isError: !!error,
    refresh: mutate,
  };
}
