"use client";

import useSWR from "swr";

interface FailedOperation {
  id: string;
  operation: string;
  error: string | null;
  createdAt: string;
  processedAt: string | null;
}

interface ImapStatusResponse {
  queue: {
    connected: boolean;
    pendingJobs: number;
    failedJobs: number;
  };
  pendingOperations: number;
  recentFailures: FailedOperation[];
  hasFailures: boolean;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useImapStatus() {
  const { data, error, mutate } = useSWR<ImapStatusResponse>(
    "/api/imap/status",
    fetcher,
    {
      refreshInterval: 60000,
      revalidateOnFocus: false,
    }
  );

  return {
    isConnected: data?.queue.connected ?? true,
    pendingOperations: data?.pendingOperations ?? 0,
    failedJobs: data?.queue.failedJobs ?? 0,
    recentFailures: data?.recentFailures ?? [],
    hasFailures: data?.hasFailures ?? false,
    isLoading: !error && !data,
    isError: !!error,
    refresh: mutate,
  };
}
