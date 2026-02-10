"use client";

import useSWR from "swr";

interface Mailbox {
  id: string;
  emailAddress: string;
  displayName: string | null;
  type: string;
  _count?: {
    threads: number;
  };
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    console.error("Failed to fetch mailboxes:", res.status, data);
    throw new Error(data.error || "Failed to fetch mailboxes");
  }
  return res.json();
}

export function useMailboxes() {
  const { data, error, isLoading, mutate } = useSWR<Mailbox[]>(
    "/api/mailboxes",
    fetcher,
    { refreshInterval: 15000, revalidateOnFocus: true }
  );

  return {
    mailboxes: data,
    isLoading,
    isError: error,
    mutate,
  };
}
