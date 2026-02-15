"use client";

import useSWR from "swr";
import { fetcher, realtimeConfig } from "@/lib/swr-config";

interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string | null;
  targetType: string | null;
  targetId: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: NotificationData[];
  unreadCount: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export function useNotifications() {
  const { data, error, isLoading, mutate } = useSWR<NotificationsResponse>(
    "/api/notifications",
    fetcher,
    realtimeConfig
  );

  return {
    notifications: data?.notifications ?? [],
    unreadCount: data?.unreadCount ?? 0,
    hasMore: data?.hasMore ?? false,
    isLoading,
    isError: error,
    mutate,
  };
}
