"use client";

import useSWR from "swr";
import { fetcher, staticConfig } from "@/lib/swr-config";

interface Mailbox {
  id: string;
  emailAddress: string;
  displayName: string | null;
  type: string;
  _count?: {
    threads: number;
  };
}

export function useMailboxes() {
  const { data, error, isLoading, mutate } = useSWR<Mailbox[]>(
    "/api/mailboxes",
    fetcher<Mailbox[]>,
    staticConfig
  );

  return {
    mailboxes: data,
    isLoading,
    isError: error,
    mutate,
  };
}
