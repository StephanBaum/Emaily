"use client";

import * as React from "react";
import DOMPurify from "dompurify";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  SmartReplySuggestions,
  type SmartReplyItem,
} from "./smart-reply-suggestions";
import { cn } from "@/lib/utils";

/**
 * Extended email data for detail view
 */
export interface EmailDetailData {
  id: string;
  subject: string;
  sender: string;
  recipients: string[];
  body: string;
  bodyHtml?: string | null;
  category: string | null;
  priority: number | null;
  summary?: string | null;
  isRead: boolean;
  isStarred: boolean;
  receivedAt: Date | string;
  threadId?: string | null;
  attachments?: Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
  }>;
}

export interface EmailDetailProps {
  email: EmailDetailData;
  /** User's name for smart reply personalization */
  userName?: string;
  /** Called when archive action is triggered */
  onArchive?: (emailId: string) => void;
  /** Called when delete action is triggered */
  onDelete?: (emailId: string) => void;
  /** Called when reply is initiated with optional smart reply content */
  onReply?: (emailId: string, content?: string) => void;
  /** Called when forward is initiated */
  onForward?: (emailId: string) => void;
  /** Called when mark as read/unread is triggered */
  onToggleRead?: (emailId: string, isRead: boolean) => void;
  /** Called when star/unstar is triggered */
  onToggleStar?: (emailId: string, isStarred: boolean) => void;
  /** Called when close/back is triggered */
  onClose?: () => void;
  /** Show smart reply suggestions */
  showSmartReplies?: boolean;
  /** Is the email actions in progress */
  isLoading?: boolean;
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
 * Format date for display
 */
function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
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
 * Priority indicator component
 */
function PriorityIndicator({ priority }: { priority: number | null }) {
  if (!priority) return null;

  const colors = {
    5: "bg-red-500",
    4: "bg-orange-500",
    3: "bg-yellow-500",
    2: "bg-blue-500",
    1: "bg-gray-400",
  };

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex h-2.5 w-2.5 rounded-full",
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
    <svg
      className="h-4 w-4"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
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
  back: (
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
        d="M10 19l-7-7m0 0l7-7m-7 7h18"
      />
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
 * EmailDetail component displays the full content of a selected email.
 *
 * Features:
 * - Full email header with sender avatar, subject, and metadata
 * - Action toolbar (reply, forward, archive, delete, star)
 * - Email body content (HTML or plain text)
 * - Attachment list
 * - AI-generated summary (if available)
 * - Smart reply suggestions integration
 * - Keyboard shortcuts support
 */
export function EmailDetail({
  email,
  userName,
  onArchive,
  onDelete,
  onReply,
  onForward,
  onToggleRead,
  onToggleStar,
  onClose,
  showSmartReplies = true,
  isLoading = false,
  className,
}: EmailDetailProps) {
  // Handle smart reply selection
  const handleSmartReplySelect = React.useCallback(
    (reply: SmartReplyItem) => {
      onReply?.(email.id, reply.content);
    },
    [email.id, onReply]
  );

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key) {
        case "r":
          if (!event.metaKey && !event.ctrlKey) {
            event.preventDefault();
            onReply?.(email.id);
          }
          break;
        case "e":
          if (!event.metaKey && !event.ctrlKey) {
            event.preventDefault();
            onArchive?.(email.id);
          }
          break;
        case "#":
        case "Delete":
          event.preventDefault();
          onDelete?.(email.id);
          break;
        case "s":
          if (!event.metaKey && !event.ctrlKey) {
            event.preventDefault();
            onToggleStar?.(email.id, !email.isStarred);
          }
          break;
        case "u":
          if (!event.metaKey && !event.ctrlKey) {
            event.preventDefault();
            onToggleRead?.(email.id, !email.isRead);
          }
          break;
        case "Escape":
          event.preventDefault();
          onClose?.();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [email, onReply, onArchive, onDelete, onToggleStar, onToggleRead, onClose]);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header with actions */}
      <div className="flex items-center justify-between gap-4 p-4 border-b">
        <div className="flex items-center gap-2">
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="Back (Esc)"
            >
              {Icons.back}
            </Button>
          )}
          <h1 className="text-lg font-semibold truncate max-w-md">
            {email.subject || "(No subject)"}
          </h1>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {onReply && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onReply(email.id)}
              disabled={isLoading}
              title="Reply (r)"
            >
              {Icons.reply}
            </Button>
          )}
          {onForward && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onForward(email.id)}
              disabled={isLoading}
              title="Forward"
            >
              {Icons.forward}
            </Button>
          )}
          {onArchive && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onArchive(email.id)}
              disabled={isLoading}
              title="Archive (e)"
            >
              {Icons.archive}
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(email.id)}
              disabled={isLoading}
              title="Delete (#)"
            >
              {Icons.delete}
            </Button>
          )}
          {onToggleStar && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggleStar(email.id, !email.isStarred)}
              disabled={isLoading}
              title={email.isStarred ? "Unstar (s)" : "Star (s)"}
              className={email.isStarred ? "text-yellow-500" : ""}
            >
              {email.isStarred ? Icons.starFilled : Icons.star}
            </Button>
          )}
          {onToggleRead && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggleRead(email.id, !email.isRead)}
              disabled={isLoading}
              title={email.isRead ? "Mark unread (u)" : "Mark read (u)"}
            >
              {email.isRead ? Icons.markUnread : Icons.markRead}
            </Button>
          )}
        </div>
      </div>

      {/* Email content */}
      <div className="flex-1 overflow-auto p-4">
        <Card>
          <CardHeader className="pb-4">
            {/* Sender info */}
            <div className="flex items-start gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="text-sm font-medium">
                  {getInitials(email.sender)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{email.sender}</p>
                    <p className="text-sm text-muted-foreground">
                      to {email.recipients.join(", ")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(email.receivedAt)}
                    </span>
                    <div className="flex items-center gap-2">
                      {email.category && (
                        <Badge
                          variant={getCategoryVariant(email.category)}
                          className="capitalize"
                        >
                          {email.category}
                        </Badge>
                      )}
                      <PriorityIndicator priority={email.priority} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Summary */}
            {email.summary && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-muted">
                <div className="flex items-center gap-2 text-sm font-medium mb-1">
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
                      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                    />
                  </svg>
                  AI Summary
                </div>
                <p className="text-sm text-muted-foreground">{email.summary}</p>
              </div>
            )}
          </CardHeader>

          <CardContent className="pt-0">
            {/* Attachments */}
            {email.attachments && email.attachments.length > 0 && (
              <div className="mb-4 pb-4 border-b">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  {Icons.attachment}
                  Attachments ({email.attachments.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {email.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 text-sm"
                    >
                      {Icons.attachment}
                      <span className="truncate max-w-[200px]">
                        {attachment.filename}
                      </span>
                      <span className="text-muted-foreground">
                        ({formatFileSize(attachment.size)})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email body */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {email.bodyHtml ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(email.bodyHtml, {
                      USE_PROFILES: { html: true },
                      FORBID_TAGS: ['script', 'style', 'iframe'],
                      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
                    })
                  }}
                  className="email-body"
                />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {email.body}
                </pre>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Smart Reply Suggestions */}
        {showSmartReplies && email.body && (
          <div className="mt-4">
            <SmartReplySuggestions
              emailSubject={email.subject}
              emailBody={email.body}
              emailSender={email.sender}
              userName={userName}
              onReplySelect={handleSmartReplySelect}
            />
          </div>
        )}
      </div>
    </div>
  );
}
