"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUnreadCount, useNotifications } from "@/hooks/use-notifications";

export function NotificationBell() {
  const router = useRouter();
  const { unreadCount, mutate: mutateCount } = useUnreadCount();
  const [open, setOpen] = useState(false);
  const { notifications, mutate: mutateList } = useNotifications(open);

  async function markAsRead(id: string) {
    // Optimistic: mark read in list cache + decrement count
    mutateList(
      (current) => {
        if (!current) return current;
        return {
          ...current,
          notifications: current.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
          unreadCount: Math.max(0, current.unreadCount - 1),
        };
      },
      { revalidate: false }
    );
    mutateCount(
      (current) => current ? { unreadCount: Math.max(0, current.unreadCount - 1) } : current,
      { revalidate: false }
    );

    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      mutateList();
      mutateCount();
    } catch {
      mutateList();
      mutateCount();
    }
  }

  async function markAllRead() {
    // Optimistic: mark all as read, set count to 0
    mutateList(
      (current) => {
        if (!current) return current;
        return {
          ...current,
          notifications: current.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        };
      },
      { revalidate: false }
    );
    mutateCount(
      () => ({ unreadCount: 0 }),
      { revalidate: false }
    );

    try {
      await fetch("/api/notifications/mark-all-read", { method: "POST" });
      mutateList();
      mutateCount();
    } catch {
      mutateList();
      mutateCount();
    }
  }

  function handleNotificationClick(notification: (typeof notifications)[0]) {
    markAsRead(notification.id);
    if (notification.targetType === "thread" && notification.targetId) {
      router.push(`/thread/${notification.targetId}`);
      setOpen(false);
    }
  }

  function getTimeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium flex items-center justify-center px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-xs">
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">
              No notifications
            </p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`w-full text-left p-3 border-b last:border-0 hover:bg-accent/50 transition-colors ${
                  !n.read ? "bg-accent/20" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${!n.read ? "font-medium" : ""}`}>
                      {n.title}
                    </p>
                    {n.message && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {n.message}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {getTimeAgo(n.createdAt)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
