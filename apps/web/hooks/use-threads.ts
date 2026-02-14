"use client";

import useSWR from "swr";
import { fetcher, realtimeConfig } from "@/lib/swr-config";

interface ThreadEmail {
  id: string;
  fromAddress: string;
  fromName: string | null;
  bodyText: string;
  date: string;
}

interface ThreadTag {
  tag: {
    id: string;
    name: string;
    color: string;
  };
}

interface ThreadAssignment {
  assignedTo: {
    id: string;
    name: string;
    email: string;
  };
}

interface Thread {
  id: string;
  subject: string;
  status: string;
  hasSentReply: boolean;
  aiStatus: string;
  aiNeedsReply: boolean | null;
  senderTrustLevel?: string | null;
  lastActivityAt: string;
  emails: ThreadEmail[];
  tags: ThreadTag[];
  assignments: ThreadAssignment[];
  seenBy: { userId: string; lastSeenEmailId: string | null; seenAt: string }[];
  _count?: {
    emails: number;
  };
}

export function useThreads(params?: {
  mailboxId?: string;
  status?: string;
  tagId?: string;
  tagIds?: string;
  query?: string;
  filter?: "unprocessed";
}) {
  const searchParams = new URLSearchParams();
  if (params?.mailboxId) searchParams.set("mailboxId", params.mailboxId);
  // Pass filter through (takes precedence over status)
  if (params?.filter) {
    searchParams.set("filter", params.filter);
  } else if (params?.status && params.status !== "open") {
    // Pass status through to API (including "all"); omit to let API use defaults
    searchParams.set("status", params.status);
  }
  if (params?.tagIds) searchParams.set("tagIds", params.tagIds);
  else if (params?.tagId) searchParams.set("tagId", params.tagId);
  if (params?.query && params.query.length >= 2) searchParams.set("q", params.query);

  const url = `/api/threads${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<Thread[]>(
    url,
    fetcher<Thread[]>,
    realtimeConfig
  );

  return {
    threads: data,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useThread(id: string) {
  const { data, error, isLoading, mutate } = useSWR<Thread>(
    id ? `/api/threads/${id}` : null,
    fetcher<Thread>,
    {
      ...realtimeConfig,
      refreshInterval: 15000, // Individual thread refreshes faster
    }
  );

  return {
    thread: data,
    isLoading,
    isError: error,
    mutate,
  };
}
