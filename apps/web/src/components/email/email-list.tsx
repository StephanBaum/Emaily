"use client";

import * as React from "react";
import { EmailListItem, type Email } from "./email-list-item";
import { cn } from "@/lib/utils";

export interface EmailListProps {
  emails: Email[];
  selectedEmailId?: string | null;
  onEmailSelect?: (email: Email) => void;
  onArchive?: (emailId: string) => void;
  onDelete?: (emailId: string) => void;
  onMarkRead?: (emailId: string) => void;
  onMarkUnread?: (emailId: string) => void;
  onToggleStar?: (emailId: string, isStarred: boolean) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

/**
 * Loading skeleton for email list items
 */
function EmailListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg border bg-card p-4 animate-pulse"
        >
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-3 w-12 bg-muted rounded" />
              </div>
              <div className="h-4 w-48 bg-muted rounded" />
              <div className="h-3 w-full bg-muted rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Empty state component for when there are no emails
 */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <svg
          className="h-8 w-8 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">No emails</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
    </div>
  );
}

/**
 * Inbox Zero celebration state
 */
function InboxZeroState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4 mb-4">
        <svg
          className="h-8 w-8 text-green-600 dark:text-green-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">
        Inbox Zero! 🎉
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        You&apos;ve processed all your emails. Great job staying on top of your inbox!
      </p>
    </div>
  );
}

/**
 * EmailList component displays a scrollable list of email items.
 *
 * Features:
 * - Displays list of EmailListItem components
 * - Loading skeleton during data fetch
 * - Empty state when no emails exist
 * - Inbox Zero celebration state
 * - Selection tracking with visual feedback
 * - Keyboard navigation support
 * - Quick actions (archive, delete, mark read, star) with optimistic updates
 */
export function EmailList({
  emails,
  selectedEmailId = null,
  onEmailSelect,
  onArchive,
  onDelete,
  onMarkRead,
  onMarkUnread,
  onToggleStar,
  isLoading = false,
  emptyMessage = "Your inbox is empty. New emails will appear here.",
  className,
}: EmailListProps) {
  const listRef = React.useRef<HTMLDivElement>(null);

  // Handle keyboard navigation through the list
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (!emails.length || !onEmailSelect) return;

      const currentIndex = emails.findIndex((e) => e.id === selectedEmailId);

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          if (currentIndex < emails.length - 1) {
            onEmailSelect(emails[currentIndex + 1]);
          } else if (currentIndex === -1) {
            onEmailSelect(emails[0]);
          }
          break;
        case "ArrowUp":
          event.preventDefault();
          if (currentIndex > 0) {
            onEmailSelect(emails[currentIndex - 1]);
          }
          break;
        case "Home":
          event.preventDefault();
          onEmailSelect(emails[0]);
          break;
        case "End":
          event.preventDefault();
          onEmailSelect(emails[emails.length - 1]);
          break;
      }
    },
    [emails, selectedEmailId, onEmailSelect]
  );

  // Show loading skeleton
  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        <EmailListSkeleton />
      </div>
    );
  }

  // Show appropriate empty state
  if (emails.length === 0) {
    // Check if this might be an "inbox zero" situation
    // (Could be enhanced with a prop to distinguish between empty inbox and zero)
    return emptyMessage.includes("processed") || emptyMessage.includes("zero") ? (
      <InboxZeroState />
    ) : (
      <EmptyState message={emptyMessage} />
    );
  }

  return (
    <div
      ref={listRef}
      className={cn("space-y-2", className)}
      role="listbox"
      aria-label="Email list"
      onKeyDown={handleKeyDown}
    >
      {emails.map((email) => (
        <EmailListItem
          key={email.id}
          email={email}
          isSelected={email.id === selectedEmailId}
          onClick={onEmailSelect}
          onArchive={onArchive}
          onDelete={onDelete}
          onMarkRead={onMarkRead}
          onMarkUnread={onMarkUnread}
          onToggleStar={onToggleStar}
        />
      ))}
    </div>
  );
}

// Re-export Email type for convenience
export type { Email };
