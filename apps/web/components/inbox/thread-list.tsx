"use client";

import { useThreads } from "@/hooks/use-threads";
import { ThreadItem } from "./thread-item";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox, Archive, Clock } from "lucide-react";

interface ThreadListProps {
  mailboxId?: string;
  status?: string;
  tagId?: string;
  tagIds?: string;
}

export function ThreadList({ mailboxId, status = "open", tagId, tagIds }: ThreadListProps) {
  const { threads, isLoading, isError } = useThreads({ mailboxId, status, tagId, tagIds });

  if (isLoading) {
    return (
      <div className="divide-y">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 p-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-destructive">Failed to load threads</p>
        <p className="text-sm text-muted-foreground">
          Please try refreshing the page
        </p>
      </div>
    );
  }

  if (!threads || threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Inbox className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">No threads found</p>
        <p className="text-sm text-muted-foreground">
          {tagId || tagIds
            ? "No threads with this tag"
            : status === "all"
            ? "No threads found"
            : status === "open"
            ? "Your inbox is empty"
            : `No ${status} threads`}
        </p>
      </div>
    );
  }

  // Show grouped view when viewing mixed statuses
  const isMixedView = status === "all" || Boolean(tagId || tagIds);

  if (!isMixedView) {
    return (
      <div className="divide-y">
        {threads.map((thread) => (
          <ThreadItem key={thread.id} thread={thread} />
        ))}
      </div>
    );
  }

  // Group threads by status for mixed views
  const grouped = threads.reduce<Record<string, typeof threads>>(
    (acc, thread) => {
      const s = thread.status || "open";
      if (!acc[s]) acc[s] = [];
      acc[s].push(thread);
      return acc;
    },
    {}
  );

  const statusOrder = ["open", "snoozed", "archived"] as const;
  const statusMeta: Record<string, { label: string; icon: typeof Inbox }> = {
    open: { label: "Open", icon: Inbox },
    snoozed: { label: "Snoozed", icon: Clock },
    archived: { label: "Archived", icon: Archive },
  };

  return (
    <div>
      {statusOrder.map((s) => {
        const group = grouped[s];
        if (!group || group.length === 0) return null;
        const meta = statusMeta[s];
        const Icon = meta.icon;

        return (
          <div key={s}>
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-muted/50 px-4 py-1.5 backdrop-blur-sm">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                {meta.label}
              </span>
              <span className="text-xs text-muted-foreground/60">
                {group.length}
              </span>
            </div>
            <div className="divide-y">
              {group.map((thread) => (
                <ThreadItem key={thread.id} thread={thread} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
