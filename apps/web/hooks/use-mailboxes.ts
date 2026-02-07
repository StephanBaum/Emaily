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
    throw new Error("Failed to fetch mailboxes");
  }
  return res.json();
}

export function useMailboxes() {
  const { data, error, isLoading, mutate } = useSWR<Mailbox[]>(
    "/api/mailboxes",
    fetcher
  );

  return {
    mailboxes: data,
    isLoading,
    isError: error,
    mutate,
  };
}
