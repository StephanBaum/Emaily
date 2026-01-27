"use client";

import * as React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Email data structure matching the Prisma Email model
 */
export interface Email {
  id: string;
  subject: string;
  sender: string;
  preview: string;
  category: string | null;
  priority: number | null;
  isRead: boolean;
  isStarred: boolean;
  receivedAt: Date | string;
}

export interface EmailListItemProps {
  email: Email;
  isSelected?: boolean;
  onClick?: (email: Email) => void;
  onArchive?: (emailId: string) => void;
  onDelete?: (emailId: string) => void;
  onMarkRead?: (emailId: string) => void;
  onMarkUnread?: (emailId: string) => void;
  onToggleStar?: (emailId: string, isStarred: boolean) => void;
  searchTerm?: string;
  className?: string;
}

/**
 * Get initials from sender name/email for avatar fallback
 */
function getInitials(sender: string): string {
  // If it's an email, extract the name part before @
  const name = sender.includes("@") ? sender.split("@")[0] : sender;
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
 * Get badge variant based on email category
 */
function getCategoryVariant(
  category: string | null
): "default" | "secondary" | "destructive" | "outline" {
  switch (category?.toLowerCase()) {
    case "important":
      return "default";
    case "promotional":
    case "social":
      return "secondary";
    case "spam":
      return "destructive";
    default:
      return "outline";
  }
}

/**
 * Format relative time for email received date
 */
function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const emailDate = typeof date === "string" ? new Date(date) : date;
  const diffMs = now.getTime() - emailDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  // Format as date for older emails
  return emailDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Escapes HTML characters to prevent XSS attacks
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Highlights search terms in text with HTML sanitization
 * Returns an object with __html property for use with dangerouslySetInnerHTML
 */
function highlightText(text: string, searchTerm?: string): { __html: string } {
  if (!searchTerm || !searchTerm.trim()) {
    return { __html: escapeHtml(text) };
  }

  // Escape the text to prevent XSS
  const escapedText = escapeHtml(text);
  const escapedSearchTerm = escapeHtml(searchTerm.trim());

  // Create a regex to find the search term (case-insensitive)
  const regex = new RegExp(`(${escapedSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");

  // Wrap matches in a mark tag with yellow background
  const highlighted = escapedText.replace(
    regex,
    '<mark class="bg-yellow-200 dark:bg-yellow-500/30 rounded px-0.5">$1</mark>'
  );

  return { __html: highlighted };
}

/**
 * Priority indicator component
 */
function PriorityIndicator({ priority }: { priority: number | null }) {
  if (!priority || priority < 4) return null;

  return (
    <span
      className={cn(
        "inline-flex h-2 w-2 rounded-full",
        priority === 5 ? "bg-red-500" : "bg-orange-500"
      )}
      title={`Priority: ${priority}/5`}
    />
  );
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
};

/**
 * Quick actions toolbar that appears on hover
 */
function QuickActions({
  email,
  onArchive,
  onDelete,
  onMarkRead,
  onMarkUnread,
  onToggleStar,
}: {
  email: Email;
  onArchive?: (emailId: string) => void;
  onDelete?: (emailId: string) => void;
  onMarkRead?: (emailId: string) => void;
  onMarkUnread?: (emailId: string) => void;
  onToggleStar?: (emailId: string, isStarred: boolean) => void;
}) {
  const handleArchive = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onArchive?.(email.id);
    },
    [email.id, onArchive]
  );

  const handleDelete = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.(email.id);
    },
    [email.id, onDelete]
  );

  const handleToggleRead = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (email.isRead) {
        onMarkUnread?.(email.id);
      } else {
        onMarkRead?.(email.id);
      }
    },
    [email.id, email.isRead, onMarkRead, onMarkUnread]
  );

  const handleToggleStar = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleStar?.(email.id, !email.isStarred);
    },
    [email.id, email.isStarred, onToggleStar]
  );

  // Only show if at least one action is available
  if (!onArchive && !onDelete && !onMarkRead && !onMarkUnread && !onToggleStar) {
    return null;
  }

  return (
    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/95 backdrop-blur-sm rounded-md p-1 shadow-sm border">
      {onToggleStar && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleStar}
          className={cn("h-7 w-7", email.isStarred && "text-yellow-500")}
          title={email.isStarred ? "Unstar" : "Star"}
        >
          {email.isStarred ? Icons.starFilled : Icons.star}
        </Button>
      )}
      {(onMarkRead || onMarkUnread) && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleRead}
          className="h-7 w-7"
          title={email.isRead ? "Mark as unread" : "Mark as read"}
        >
          {email.isRead ? Icons.markUnread : Icons.markRead}
        </Button>
      )}
      {onArchive && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleArchive}
          className="h-7 w-7"
          title="Archive"
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
          title="Delete"
        >
          {Icons.delete}
        </Button>
      )}
    </div>
  );
}

/**
 * EmailListItem component displays a single email in the inbox list.
 *
 * Features:
 * - Shows sender avatar with initials
 * - Displays subject, preview, and category badge
 * - Visual distinction between read and unread emails
 * - Priority indicator for high-priority emails
 * - Click handling for selection
 * - Quick action buttons on hover (archive, delete, star, read/unread)
 */
export function EmailListItem({
  email,
  isSelected = false,
  onClick,
  onArchive,
  onDelete,
  onMarkRead,
  onMarkUnread,
  onToggleStar,
  searchTerm,
  className,
}: EmailListItemProps) {
  const handleClick = React.useCallback(() => {
    onClick?.(email);
  }, [email, onClick]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onClick?.(email);
      }
      // Keyboard shortcuts for actions
      if (event.key === "e" && onArchive) {
        event.preventDefault();
        onArchive(email.id);
      }
      if ((event.key === "#" || event.key === "Delete") && onDelete) {
        event.preventDefault();
        onDelete(email.id);
      }
      if (event.key === "s" && onToggleStar) {
        event.preventDefault();
        onToggleStar(email.id, !email.isStarred);
      }
    },
    [email, onClick, onArchive, onDelete, onToggleStar]
  );

  return (
    <Card
      className={cn(
        "cursor-pointer transition-colors hover:bg-accent/50 relative group",
        email.isRead && "opacity-60",
        isSelected && "ring-2 ring-primary bg-accent/30",
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Email from ${email.sender}: ${email.subject}`}
      aria-selected={isSelected}
    >
      <CardHeader className="flex flex-row items-start gap-4 space-y-0 p-4 pb-2">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="text-xs font-medium">
            {getInitials(email.sender)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "truncate text-sm",
                !email.isRead && "font-semibold"
              )}
              dangerouslySetInnerHTML={highlightText(email.sender, searchTerm)}
            />
            <div className="flex items-center gap-2 shrink-0 pr-24 group-hover:pr-32">
              {email.isStarred && (
                <span className="text-yellow-500">{Icons.starFilled}</span>
              )}
              <PriorityIndicator priority={email.priority} />
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(email.receivedAt)}
              </span>
            </div>
          </div>

          <h3
            className={cn(
              "text-sm truncate",
              !email.isRead && "font-medium"
            )}
            dangerouslySetInnerHTML={highlightText(
              email.subject || "(No subject)",
              searchTerm
            )}
          />
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0 pl-[72px]">
        <div className="flex items-start justify-between gap-2">
          <p
            className="text-muted-foreground text-sm line-clamp-2 flex-1"
            dangerouslySetInnerHTML={highlightText(email.preview, searchTerm)}
          />
          {email.category && (
            <Badge
              variant={getCategoryVariant(email.category)}
              className="shrink-0 capitalize"
            >
              {email.category}
            </Badge>
          )}
        </div>
      </CardContent>

      {/* Quick actions toolbar */}
      <QuickActions
        email={email}
        onArchive={onArchive}
        onDelete={onDelete}
        onMarkRead={onMarkRead}
        onMarkUnread={onMarkUnread}
        onToggleStar={onToggleStar}
      />
    </Card>
  );
}
