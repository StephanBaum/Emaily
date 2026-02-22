"use client";

import useSWR from "swr";
import { fetcher, stableConfig, realtimeConfig } from "@/lib/swr-config";

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

interface UnreadCountResponse {
  unreadCount: number;
}

/** Cheap unread count — cached server-side, safe to poll from layout */
export function useUnreadCount() {
  const { data, mutate } = useSWR<UnreadCountResponse>(
    "/api/notifications/unread-count",
    fetcher,
    stableConfig
  );

  return {
    unreadCount: data?.unreadCount ?? 0,
    mutate,
  };
}

/** Full notification list — only fetch when popover is open */
export function useNotifications(enabled: boolean) {
  const { data, error, isLoading, mutate } = useSWR<NotificationsResponse>(
    enabled ? "/api/notifications" : null,
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
