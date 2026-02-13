"use client";

import useSWR from "swr";

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
  lastActivityAt: string;
  emails: ThreadEmail[];
  tags: ThreadTag[];
  assignments: ThreadAssignment[];
  seenBy: { userId: string; lastSeenEmailId: string | null; seenAt: string }[];
  _count?: {
    emails: number;
  };
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch threads");
  }
  return res.json();
}

export function useThreads(params?: {
  mailboxId?: string;
  status?: string;
  tagId?: string;
  tagIds?: string;
  query?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.mailboxId) searchParams.set("mailboxId", params.mailboxId);
  // Pass status through to API (including "all"); omit to let API use defaults
  if (params?.status && params.status !== "open") {
    searchParams.set("status", params.status);
  }
  if (params?.tagIds) searchParams.set("tagIds", params.tagIds);
  else if (params?.tagId) searchParams.set("tagId", params.tagId);
  if (params?.query && params.query.length >= 2) searchParams.set("q", params.query);

  const url = `/api/threads${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<Thread[]>(url, fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
  });

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
    fetcher,
    { refreshInterval: 15000, revalidateOnFocus: true }
  );

  return {
    thread: data,
    isLoading,
    isError: error,
    mutate,
  };
}
