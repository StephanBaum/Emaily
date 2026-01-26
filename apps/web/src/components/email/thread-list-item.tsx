"use client";

import * as React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Email thread data structure matching the API response
 */
export interface EmailThread {
  /** Thread ID - null for emails without a thread */
  threadId: string | null;
  /** Subject from the most recent email in thread */
  subject: string;
  /** Unique participants in the thread */
  participants: string[];
  /** Number of messages in the thread */
  messageCount: number;
  /** Preview of the latest message body */
  preview: string;
  /** Whether all messages in thread are read */
  isRead: boolean;
  /** Whether any message in thread is starred */
  isStarred: boolean;
  /** Timestamp of the most recent message */
  lastMessageAt: Date | string;
  /** ID of the most recent email in the thread */
  latestEmailId: string;
}

export interface ThreadListItemProps {
  thread: EmailThread;
  isSelected?: boolean;
  onClick?: (thread: EmailThread) => void;
  onArchive?: (threadId: string) => void;
  onDelete?: (threadId: string) => void;
  onMarkRead?: (threadId: string) => void;
  onMarkUnread?: (threadId: string) => void;
  onToggleStar?: (threadId: string, isStarred: boolean) => void;
  className?: string;
}

/**
 * Get initials from participant name/email for avatar fallback
 */
function getInitials(participant: string): string {
  // If it's an email, extract the name part before @
  const name = participant.includes("@")
    ? participant.split("@")[0]
    : participant;
  // Get first two characters, uppercase
  return name
    .split(/[.\-_\s]+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Format relative time for thread last message date
 */
function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const messageDate = typeof date === "string" ? new Date(date) : date;
  const diffMs = now.getTime() - messageDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  // Format as date for older threads
  return messageDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Action button icons
 */
const Icons = {
  archive: (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  ),
  delete: (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  ),
  star: (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  ),
  starFilled: (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  markRead: (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  ),
  markUnread: (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76"
      />
    </svg>
  ),
  messages: (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
      />
    </svg>
  ),
};

/**
 * Participant avatars component - shows up to 3 participants
 */
function ParticipantAvatars({ participants }: { participants: string[] }) {
  const displayedParticipants = participants.slice(0, 3);
  const remainingCount = participants.length - displayedParticipants.length;

  return (
    <div className="flex items-center -space-x-2">
      {displayedParticipants.map((participant, index) => (
        <Avatar
          key={`${participant}-${index}`}
          className="h-10 w-10 shrink-0 border-2 border-background"
          title={participant}
        >
          <AvatarFallback className="text-xs font-medium">
            {getInitials(participant)}
          </AvatarFallback>
        </Avatar>
      ))}
      {remainingCount > 0 && (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium"
          title={`${remainingCount} more participant${remainingCount > 1 ? "s" : ""}`}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}

/**
 * Quick actions toolbar that appears on hover
 */
function QuickActions({
  thread,
  onArchive,
  onDelete,
  onMarkRead,
  onMarkUnread,
  onToggleStar,
}: {
  thread: EmailThread;
  onArchive?: (threadId: string) => void;
  onDelete?: (threadId: string) => void;
  onMarkRead?: (threadId: string) => void;
  onMarkUnread?: (threadId: string) => void;
  onToggleStar?: (threadId: string, isStarred: boolean) => void;
}) {
  const threadKey = thread.threadId || thread.latestEmailId;

  const handleArchive = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onArchive?.(threadKey);
    },
    [threadKey, onArchive]
  );

  const handleDelete = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.(threadKey);
    },
    [threadKey, onDelete]
  );

  const handleToggleRead = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (thread.isRead) {
        onMarkUnread?.(threadKey);
      } else {
        onMarkRead?.(threadKey);
      }
    },
    [threadKey, thread.isRead, onMarkRead, onMarkUnread]
  );

  const handleToggleStar = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleStar?.(threadKey, !thread.isStarred);
    },
    [threadKey, thread.isStarred, onToggleStar]
  );

  // Only show if at least one action is available
  if (
    !onArchive &&
    !onDelete &&
    !onMarkRead &&
    !onMarkUnread &&
    !onToggleStar
  ) {
    return null;
  }

  return (
    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/95 backdrop-blur-sm rounded-md p-1 shadow-sm border">
      {onToggleStar && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleStar}
          className={cn("h-7 w-7", thread.isStarred && "text-yellow-500")}
          title={thread.isStarred ? "Unstar thread" : "Star thread"}
        >
          {thread.isStarred ? Icons.starFilled : Icons.star}
        </Button>
      )}
      {(onMarkRead || onMarkUnread) && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleRead}
          className="h-7 w-7"
          title={
            thread.isRead ? "Mark thread as unread" : "Mark thread as read"
          }
        >
          {thread.isRead ? Icons.markUnread : Icons.markRead}
        </Button>
      )}
      {onArchive && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleArchive}
          className="h-7 w-7"
          title="Archive thread"
        >
          {Icons.archive}
        </Button>
      )}
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          className="h-7 w-7 hover:text-destructive"
          title="Delete thread"
        >
          {Icons.delete}
        </Button>
      )}
    </div>
  );
}

/**
 * Format participants list for display
 */
function formatParticipants(participants: string[], maxLength = 50): string {
  if (participants.length === 0) return "Unknown";
  if (participants.length === 1) return participants[0];

  // Show first 2-3 participants, then add "and X more" if needed
  let result = participants[0];
  let count = 1;

  for (let i = 1; i < participants.length && result.length < maxLength; i++) {
    if (i === participants.length - 1) {
      result += ` and ${participants[i]}`;
    } else {
      result += `, ${participants[i]}`;
    }
    count++;
  }

  const remaining = participants.length - count;
  if (remaining > 0) {
    result += ` and ${remaining} more`;
  }

  return result;
}

/**
 * ThreadListItem component displays a thread preview in the inbox list.
 *
 * Features:
 * - Shows participant avatars (up to 3, with overflow indicator)
 * - Displays subject, preview, and message count badge
 * - Visual distinction between read and unread threads
 * - Click handling for selection
 * - Quick action buttons on hover (archive, delete, star, read/unread)
 * - Keyboard navigation support
 */
export function ThreadListItem({
  thread,
  isSelected = false,
  onClick,
  onArchive,
  onDelete,
  onMarkRead,
  onMarkUnread,
  onToggleStar,
  className,
}: ThreadListItemProps) {
  const handleClick = React.useCallback(() => {
    onClick?.(thread);
  }, [thread, onClick]);

  const threadKey = thread.threadId || thread.latestEmailId;

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onClick?.(thread);
      }
      // Keyboard shortcuts for actions
      if (event.key === "e" && onArchive) {
        event.preventDefault();
        onArchive(threadKey);
      }
      if ((event.key === "#" || event.key === "Delete") && onDelete) {
        event.preventDefault();
        onDelete(threadKey);
      }
      if (event.key === "s" && onToggleStar) {
        event.preventDefault();
        onToggleStar(threadKey, !thread.isStarred);
      }
    },
    [thread, threadKey, onClick, onArchive, onDelete, onToggleStar]
  );

  const participantsText = formatParticipants(thread.participants);

  return (
    <Card
      className={cn(
        "cursor-pointer transition-colors hover:bg-accent/50 relative group",
        thread.isRead && "opacity-60",
        isSelected && "ring-2 ring-primary bg-accent/30",
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Thread: ${thread.subject} with ${thread.messageCount} message${thread.messageCount !== 1 ? "s" : ""}`}
      aria-selected={isSelected}
    >
      <CardHeader className="flex flex-row items-start gap-4 space-y-0 p-4 pb-2">
        <ParticipantAvatars participants={thread.participants} />

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "truncate text-sm",
                !thread.isRead && "font-semibold"
              )}
              title={participantsText}
            >
              {participantsText}
            </span>
            <div className="flex items-center gap-2 shrink-0 pr-24 group-hover:pr-32">
              {thread.isStarred && (
                <span className="text-yellow-500" title="Starred">
                  {Icons.starFilled}
                </span>
              )}
              {thread.messageCount > 1 && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 text-xs"
                  title={`${thread.messageCount} messages in thread`}
                >
                  {Icons.messages}
                  <span>{thread.messageCount}</span>
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(thread.lastMessageAt)}
              </span>
            </div>
          </div>

          <h3
            className={cn(
              "text-sm truncate",
              !thread.isRead && "font-medium"
            )}
          >
            {thread.subject || "(No subject)"}
          </h3>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0 pl-[88px]">
        <p className="text-muted-foreground text-sm line-clamp-2">
          {thread.preview}
        </p>
      </CardContent>

      {/* Quick actions toolbar */}
      <QuickActions
        thread={thread}
        onArchive={onArchive}
        onDelete={onDelete}
        onMarkRead={onMarkRead}
        onMarkUnread={onMarkUnread}
        onToggleStar={onToggleStar}
      />
    </Card>
  );
}
