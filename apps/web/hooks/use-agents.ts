"use client";

import useSWR from "swr";
import { fetcher, staticConfig } from "@/lib/swr-config";

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

export function useAgents() {
  const { data, error, isLoading, mutate } = useSWR<AgentData[]>(
    "/api/agents",
    fetcher<AgentData[]>,
    staticConfig
  );

  return {
    agents: data,
    isLoading,
    isError: error,
    mutate,
  };
}
