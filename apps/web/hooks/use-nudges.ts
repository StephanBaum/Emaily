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

export function useNudges() {
  const { data, error, mutate } = useSWR<NudgesResponse>(
    "/api/nudges",
    null,
    {
      refreshInterval: 120000,
      revalidateOnFocus: false,
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
