"use client";

import * as React from "react";
import DOMPurify from "dompurify";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Email message data for thread display
 */
export interface ThreadMessageData {
  id: string;
  subject: string;
  sender: string;
  recipients: string[];
  body: string;
  bodyHtml?: string | null;
  category: string | null;
  priority: number | null;
  isRead: boolean;
  isStarred: boolean;
  receivedAt: Date | string;
  attachments?: Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
  }>;
}

export interface ThreadMessageProps {
  message: ThreadMessageData;
  /** Whether message is expanded */
  isExpanded?: boolean;
  /** Whether this is the first message in thread */
  isFirst?: boolean;
  /** Whether this is the last (most recent) message in thread */
  isLast?: boolean;
  /** Called when expand/collapse is toggled */
  onToggleExpand?: (messageId: string) => void;
  /** Called when reply action is triggered */
  onReply?: (messageId: string) => void;
  /** Called when forward action is triggered */
  onForward?: (messageId: string) => void;
  /** Called when star/unstar is triggered */
  onToggleStar?: (messageId: string, isStarred: boolean) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get initials from sender name/email for avatar fallback
 */
function getInitials(sender: string): string {
  const name = sender.includes("@") ? sender.split("@")[0] : sender;
  return name
    .split(/[.\-_\s]+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Format date for display
 */
function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  // Show relative time for recent messages
  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "Just now";
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  // Show full date for older messages
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
 * Action button icon components
 */
const Icons = {
  reply: (
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
        d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
      />
    </svg>
  ),
  forward: (
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
        d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"
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
  chevronDown: (
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
        d="M19 9l-7 7-7-7"
      />
    </svg>
  ),
  chevronRight: (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  ),
  attachment: (
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
        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
      />
    </svg>
  ),
};

/**
 * Priority indicator component
 */
function PriorityIndicator({ priority }: { priority: number | null }) {
  if (!priority || priority < 4) return null;

  const colors = {
    5: "bg-red-500",
    4: "bg-orange-500",
  };

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex h-2 w-2 rounded-full",
          colors[priority as keyof typeof colors] || "bg-gray-400"
        )}
      />
      <span className="text-xs text-muted-foreground">
        Priority {priority}/5
      </span>
    </div>
  );
}

/**
 * Collapsed message preview
 */
function CollapsedPreview({
  message,
  onClick,
}: {
  message: ThreadMessageData;
  onClick: () => void;
}) {
  // Extract plain text preview from body
  const previewText = message.body.substring(0, 100).replace(/\s+/g, " ");

  return (
    <div
      className="flex items-center gap-3 py-2 px-3 hover:bg-accent/50 rounded-md cursor-pointer transition-colors"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {Icons.chevronRight}
      </Button>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="text-xs">
          {getInitials(message.sender)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium truncate">{message.sender}</span>
          <span className="text-muted-foreground text-xs">
            {formatDate(message.receivedAt)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground truncate">{previewText}</p>
      </div>
      {message.attachments && message.attachments.length > 0 && (
        <Badge variant="outline" className="shrink-0">
          {Icons.attachment}
          <span className="ml-1">{message.attachments.length}</span>
        </Badge>
      )}
    </div>
  );
}

/**
 * Expanded message content
 */
function ExpandedContent({ message }: { message: ThreadMessageData }) {
  const sanitizedHtml = React.useMemo(() => {
    if (!message.bodyHtml) return null;
    return {
      __html: DOMPurify.sanitize(message.bodyHtml, {
        ADD_ATTR: ["target"],
        FORBID_TAGS: ["script", "style"],
      }),
    };
  }, [message.bodyHtml]);

  return (
    <div className="space-y-4">
      {/* Recipients */}
      {message.recipients.length > 0 && (
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">To:</span>{" "}
          {message.recipients.join(", ")}
        </div>
      )}

      {/* Category and Priority */}
      {(message.category || (message.priority && message.priority >= 4)) && (
        <div className="flex items-center gap-2">
          {message.category && (
            <Badge variant={getCategoryVariant(message.category)}>
              {message.category}
            </Badge>
          )}
          <PriorityIndicator priority={message.priority} />
        </div>
      )}

      {/* Message body */}
      <div className="prose prose-sm max-w-none">
        {sanitizedHtml ? (
          <div dangerouslySetInnerHTML={sanitizedHtml} />
        ) : (
          <p className="whitespace-pre-wrap">{message.body}</p>
        )}
      </div>

      {/* Attachments */}
      {message.attachments && message.attachments.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-2">
            Attachments ({message.attachments.length})
          </h4>
          <div className="space-y-2">
            {message.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-3 p-2 rounded-md border hover:bg-accent/50 transition-colors"
              >
                <div className="text-muted-foreground">{Icons.attachment}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {attachment.filename}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.size)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ThreadMessage component displays an individual message within an email thread.
 *
 * Features:
 * - Collapsible/expandable message content
 * - Shows sender avatar and information
 * - Displays message body with HTML sanitization
 * - Shows attachments with file size
 * - Quick action buttons (reply, forward, star)
 * - Visual distinction for first/last messages in thread
 * - Category and priority indicators
 */
export function ThreadMessage({
  message,
  isExpanded = false,
  isFirst: _isFirst = false,
  isLast = false,
  onToggleExpand,
  onReply,
  onForward,
  onToggleStar,
  className,
}: ThreadMessageProps) {
  const handleToggleExpand = React.useCallback(() => {
    onToggleExpand?.(message.id);
  }, [message.id, onToggleExpand]);

  const handleReply = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onReply?.(message.id);
    },
    [message.id, onReply]
  );

  const handleForward = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onForward?.(message.id);
    },
    [message.id, onForward]
  );

  const handleToggleStar = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleStar?.(message.id, !message.isStarred);
    },
    [message.id, message.isStarred, onToggleStar]
  );

  // Automatically expand the last (most recent) message
  const shouldExpand = isExpanded || isLast;

  if (!shouldExpand) {
    return (
      <div className={cn("border-l-2 border-border pl-4 ml-6", className)}>
        <CollapsedPreview message={message} onClick={handleToggleExpand} />
      </div>
    );
  }

  return (
    <Card
      className={cn(
        "border-l-4 transition-colors",
        isLast && "border-l-primary",
        !isLast && "border-l-border",
        className
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 mt-1"
            onClick={handleToggleExpand}
          >
            {Icons.chevronDown}
          </Button>

          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="text-sm">
              {getInitials(message.sender)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">
                  {message.sender}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {formatDate(message.receivedAt)}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {onToggleStar && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleToggleStar}
                    className={cn(
                      "h-8 w-8",
                      message.isStarred && "text-yellow-500"
                    )}
                    title={message.isStarred ? "Unstar" : "Star"}
                  >
                    {message.isStarred ? Icons.starFilled : Icons.star}
                  </Button>
                )}
                {onReply && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleReply}
                    className="h-8 w-8"
                    title="Reply"
                  >
                    {Icons.reply}
                  </Button>
                )}
                {onForward && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleForward}
                    className="h-8 w-8"
                    title="Forward"
                  >
                    {Icons.forward}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pl-[72px]">
        <ExpandedContent message={message} />
      </CardContent>
    </Card>
  );
}
