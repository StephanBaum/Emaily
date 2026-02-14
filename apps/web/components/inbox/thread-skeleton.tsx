"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface ThreadSkeletonProps {
  count?: number;
}

export function ThreadSkeleton({ count = 5 }: ThreadSkeletonProps) {
  return (
    <div className="divide-y">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-4 p-4 animate-pulse"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          {/* Avatar */}
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />

          {/* Content */}
          <div className="flex-1 space-y-2 overflow-hidden">
            {/* Header row: sender + time */}
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-12" />
            </div>

            {/* Subject */}
            <Skeleton className="h-4 w-3/4" />

            {/* Preview */}
            <Skeleton className="h-3 w-full max-w-md" />

            {/* Tags (randomly show on some items) */}
            {i % 2 === 0 && (
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-5 w-16 rounded-full" />
                {i % 3 === 0 && <Skeleton className="h-5 w-12 rounded-full" />}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Compact skeleton for sidebar thread counts
 */
export function SidebarSkeleton() {
  return (
    <div className="space-y-1 px-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-3 py-2 animate-pulse"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-6 rounded-full" />
        </div>
      ))}
    </div>
  );
}
