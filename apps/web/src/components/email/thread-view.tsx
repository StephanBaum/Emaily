"use client";

import * as React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThreadMessage, type ThreadMessageData } from "./thread-message";
import { cn } from "@/lib/utils";

/**
 * Thread data for conversation view
 */
export interface ThreadData {
  threadId: string;
  subject: string;
  messages: ThreadMessageData[];
  participants: string[];
  /** AI-generated summary for threads with 5+ messages */
  summary?: string | null;
}

export interface ThreadViewProps {
  thread: ThreadData;
  /** User's name for reply personalization */
  userName?: string;
  /** Called when archive action is triggered for entire thread */
  onArchive?: (threadId: string) => void;
  /** Called when delete action is triggered for entire thread */
  onDelete?: (threadId: string) => void;
  /** Called when reply is initiated for a specific message */
  onReply?: (messageId: string) => void;
  /** Called when forward is initiated for a specific message */
  onForward?: (messageId: string) => void;
  /** Called when star/unstar is triggered for a specific message */
  onToggleStar?: (messageId: string, isStarred: boolean) => void;
  /** Called when close/back is triggered */
  onClose?: () => void;
  /** Is the thread actions in progress */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get initials from participant name/email for avatar fallback
 */
function getInitials(participant: string): string {
  const name = participant.includes("@")
    ? participant.split("@")[0]
    : participant;
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
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Action button icon components
 */
const Icons = {
  back: (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
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
  sparkles: (
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
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  ),
};

/**
 * Thread header showing subject and participants
 */
function ThreadHeader({
  thread,
  onClose,
  onArchive,
  onDelete,
  isLoading,
}: {
  thread: ThreadData;
  onClose?: () => void;
  onArchive?: (threadId: string) => void;
  onDelete?: (threadId: string) => void;
  isLoading?: boolean;
}) {
  const messageCount = thread.messages.length;
  const earliestMessage = thread.messages[0];
  const latestMessage = thread.messages[messageCount - 1];

  return (
    <div className="border-b pb-4 mb-6">
      <div className="flex items-start gap-3 mb-4">
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="shrink-0"
            title="Back to inbox"
          >
            {Icons.back}
          </Button>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold mb-2">{thread.subject}</h1>

          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {messageCount} {messageCount === 1 ? "message" : "messages"}
            </span>
            <span>•</span>
            <span>
              {formatDate(earliestMessage.receivedAt)} -{" "}
              {formatDate(latestMessage.receivedAt)}
            </span>
          </div>
        </div>

        {/* Thread actions */}
        <div className="flex items-center gap-1 shrink-0">
          {onArchive && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onArchive(thread.threadId)}
              disabled={isLoading}
              title="Archive thread"
            >
              {Icons.archive}
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(thread.threadId)}
              disabled={isLoading}
              title="Delete thread"
            >
              {Icons.delete}
            </Button>
          )}
        </div>
      </div>

      {/* Participants */}
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {thread.participants.slice(0, 5).map((participant, index) => (
            <Avatar
              key={`${participant}-${index}`}
              className="h-8 w-8 border-2 border-background"
            >
              <AvatarFallback className="text-xs">
                {getInitials(participant)}
              </AvatarFallback>
            </Avatar>
          ))}
          {thread.participants.length > 5 && (
            <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
              <span className="text-xs font-medium text-muted-foreground">
                +{thread.participants.length - 5}
              </span>
            </div>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {thread.participants.length === 1 ? (
            <span>{thread.participants[0]}</span>
          ) : (
            <span>
              {thread.participants.slice(0, 2).join(", ")}
              {thread.participants.length > 2 &&
                ` and ${thread.participants.length - 2} other${
                  thread.participants.length - 2 === 1 ? "" : "s"
                }`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * AI summary card for long threads
 */
function AISummaryCard({ summary }: { summary: string }) {
  return (
    <Card className="mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="text-blue-600 dark:text-blue-400">{Icons.sparkles}</div>
          <h3 className="font-semibold text-sm">AI Summary</h3>
          <Badge variant="secondary" className="ml-auto">
            Beta
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-foreground/90">{summary}</p>
      </CardContent>
    </Card>
  );
}

/**
 * ThreadView component displays a full email conversation thread.
 *
 * Features:
 * - Shows all messages in chronological order
 * - Displays thread header with subject, participants, and message count
 * - Shows AI summary for threads with 5+ messages
 * - Supports expand/collapse for individual messages
 * - Thread-level actions (archive, delete)
 * - Message-level actions (reply, forward, star)
 * - Participant avatars with overflow indicator
 */
export function ThreadView({
  thread,
  userName: _userName,
  onArchive,
  onDelete,
  onReply,
  onForward,
  onToggleStar,
  onClose,
  isLoading = false,
  className,
}: ThreadViewProps) {
  // Track which messages are expanded
  const [expandedMessages, setExpandedMessages] = React.useState<Set<string>>(
    new Set()
  );

  // Handle message expand/collapse
  const handleToggleExpand = React.useCallback((messageId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  // Sort messages chronologically (oldest first)
  const sortedMessages = React.useMemo(() => {
    return [...thread.messages].sort((a, b) => {
      const dateA =
        typeof a.receivedAt === "string"
          ? new Date(a.receivedAt)
          : a.receivedAt;
      const dateB =
        typeof b.receivedAt === "string"
          ? new Date(b.receivedAt)
          : b.receivedAt;
      return dateA.getTime() - dateB.getTime();
    });
  }, [thread.messages]);

  // Determine if AI summary should be shown (5+ messages)
  const showAISummary = thread.summary && thread.messages.length >= 5;

  return (
    <div className={cn("max-w-4xl mx-auto px-4 py-6", className)}>
      <ThreadHeader
        thread={thread}
        onClose={onClose}
        onArchive={onArchive}
        onDelete={onDelete}
        isLoading={isLoading}
      />

      {/* AI Summary for long threads */}
      {showAISummary && <AISummaryCard summary={thread.summary!} />}

      {/* Thread messages */}
      <div className="space-y-4">
        {sortedMessages.map((message, index) => {
          const isFirst = index === 0;
          const isLast = index === sortedMessages.length - 1;
          const isExpanded = expandedMessages.has(message.id);

          return (
            <ThreadMessage
              key={message.id}
              message={message}
              isExpanded={isExpanded}
              isFirst={isFirst}
              isLast={isLast}
              onToggleExpand={handleToggleExpand}
              onReply={onReply}
              onForward={onForward}
              onToggleStar={onToggleStar}
            />
          );
        })}
      </div>
    </div>
  );
}
