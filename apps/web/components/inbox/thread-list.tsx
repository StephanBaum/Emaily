"use client";

import { useThreads } from "@/hooks/use-threads";
import { ThreadItem } from "./thread-item";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "lucide-react";

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
            : status === "open"
            ? "Your inbox is empty"
            : `No ${status} threads`}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {threads.map((thread) => (
        <ThreadItem key={thread.id} thread={thread} />
      ))}
    </div>
  );
}
