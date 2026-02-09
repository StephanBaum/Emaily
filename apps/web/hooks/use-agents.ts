"use client";

import useSWR from "swr";

export interface AgentData {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  avatar: string | null;
  temperature: number;
  active: boolean;
  isDefault: boolean;
  tagWatches: { tagId: string }[];
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to fetch agents");
  }
  return res.json();
}

export function useAgents() {
  const { data, error, isLoading, mutate } = useSWR<AgentData[]>(
    "/api/agents",
    fetcher,
    { refreshInterval: 60000, revalidateOnFocus: true }
  );

  return {
    agents: data,
    isLoading,
    isError: error,
    mutate,
  };
}
