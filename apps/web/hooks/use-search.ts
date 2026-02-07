"use client";

import useSWR from "swr";
import { useState, useEffect } from "react";

interface SearchThread {
  id: string;
  subject: string;
  status: string;
  hasSentReply: boolean;
  lastActivityAt: string;
  emails: {
    id: string;
    fromAddress: string;
    fromName: string | null;
    bodyText: string;
    date: string;
  }[];
  tags: {
    tag: {
      id: string;
      name: string;
      color: string;
    };
  }[];
  assignments: {
    assignedTo: {
      id: string;
      name: string;
      email: string;
    };
  }[];
  seenBy: { userId: string }[];
  _count?: { emails: number };
}

interface SearchResponse {
  threads: SearchThread[];
  total: number;
  highlights: Record<string, string>;
}

async function fetcher(url: string): Promise<SearchResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to search");
  }
  return res.json();
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function useSearch(params: {
  query: string;
  status?: string;
  tagId?: string;
  mailboxId?: string;
  limit?: number;
  offset?: number;
}) {
  const debouncedQuery = useDebounce(params.query, 300);

  const searchParams = new URLSearchParams();
  if (debouncedQuery.length >= 2) {
    searchParams.set("q", debouncedQuery);
  }
  if (params.status) searchParams.set("status", params.status);
  if (params.tagId) searchParams.set("tagId", params.tagId);
  if (params.mailboxId) searchParams.set("mailboxId", params.mailboxId);
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.offset) searchParams.set("offset", String(params.offset));

  const url =
    debouncedQuery.length >= 2
      ? `/api/search?${searchParams.toString()}`
      : null;

  const { data, error, isLoading } = useSWR<SearchResponse>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 500,
  });

  return {
    results: data?.threads,
    total: data?.total ?? 0,
    highlights: data?.highlights ?? {},
    isLoading: isLoading && debouncedQuery.length >= 2,
    isError: error,
    isDebouncing: params.query !== debouncedQuery,
  };
}
