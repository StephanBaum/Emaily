"use client";

import useSWR from "swr";
import { fetcher, stableConfig } from "@/lib/swr-config";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  teamName: string;
  hasAvatar: boolean;
}

export function useUserProfile() {
  const { data, error, isLoading, mutate } = useSWR<UserProfile>(
    "/api/user/profile",
    fetcher<UserProfile>,
    { ...stableConfig, revalidateOnFocus: true }
  );

  return {
    profile: data,
    isLoading,
    isError: error,
    mutate,
  };
}
