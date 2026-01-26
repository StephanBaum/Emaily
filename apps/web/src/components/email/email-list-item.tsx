"use client";

import * as React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
 * EmailListItem component displays a single email in the inbox list.
 *
 * Features:
 * - Shows sender avatar with initials
 * - Displays subject, preview, and category badge
 * - Visual distinction between read and unread emails
 * - Priority indicator for high-priority emails
 * - Click handling for selection
 */
export function EmailListItem({
  email,
  isSelected = false,
  onClick,
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
    },
    [email, onClick]
  );

  return (
    <Card
      className={cn(
        "cursor-pointer transition-colors hover:bg-accent/50",
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
            >
              {email.sender}
            </span>
            <div className="flex items-center gap-2 shrink-0">
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
          >
            {email.subject || "(No subject)"}
          </h3>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0 pl-[72px]">
        <div className="flex items-start justify-between gap-2">
          <p className="text-muted-foreground text-sm line-clamp-2 flex-1">
            {email.preview}
          </p>
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
    </Card>
  );
}
