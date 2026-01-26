"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Reply tone type matching the AI schema
 */
export type ReplyTone = "formal" | "casual" | "friendly" | "professional";

/**
 * Smart reply item structure from AI
 */
export interface SmartReplyItem {
  tone: ReplyTone;
  content: string;
  isShort: boolean;
}

export interface SmartReplySuggestionsProps {
  /** Email subject for context */
  emailSubject: string;
  /** Email body for context */
  emailBody: string;
  /** Email sender for context */
  emailSender?: string;
  /** Called when a reply is selected */
  onReplySelect?: (reply: SmartReplyItem) => void;
  /** Number of replies to generate (default: 3) */
  replyCount?: number;
  /** User's name for personalization */
  userName?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get badge variant based on reply tone
 */
function getToneBadgeVariant(
  tone: ReplyTone
): "default" | "secondary" | "outline" {
  switch (tone) {
    case "formal":
    case "professional":
      return "default";
    case "casual":
    case "friendly":
      return "secondary";
    default:
      return "outline";
  }
}

/**
 * Loading skeleton for smart reply suggestions
 */
function SmartReplySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg border bg-card p-3 animate-pulse"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="h-5 w-16 bg-muted rounded-full" />
            <div className="h-4 w-12 bg-muted rounded" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-full bg-muted rounded" />
            <div className="h-3 w-3/4 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Error state for failed suggestions
 */
function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <div className="rounded-full bg-destructive/10 p-3 mb-3">
        <svg
          className="h-5 w-5 text-destructive"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <p className="text-sm text-muted-foreground mb-3">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}

/**
 * Individual smart reply suggestion card
 */
function ReplyCard({
  reply,
  onSelect,
}: {
  reply: SmartReplyItem;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-lg border bg-card p-3",
        "transition-colors hover:bg-accent/50",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Badge variant={getToneBadgeVariant(reply.tone)} className="capitalize">
          {reply.tone}
        </Badge>
        {reply.isShort && (
          <span className="text-xs text-muted-foreground">Quick reply</span>
        )}
      </div>
      <p className="text-sm text-foreground line-clamp-3">{reply.content}</p>
    </button>
  );
}

/**
 * SmartReplySuggestions component fetches and displays AI-generated reply suggestions.
 *
 * Features:
 * - Automatically fetches suggestions on mount
 * - Shows 3 reply options with different tones
 * - Loading skeleton during generation
 * - Error state with retry option
 * - Click to select and use a suggestion
 */
export function SmartReplySuggestions({
  emailSubject,
  emailBody,
  emailSender,
  onReplySelect,
  replyCount = 3,
  userName,
  className,
}: SmartReplySuggestionsProps) {
  const [replies, setReplies] = React.useState<SmartReplyItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch smart reply suggestions
  const fetchReplies = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/smart-reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: emailSubject,
          body: emailBody,
          sender: emailSender,
          replyCount,
          userName,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `Failed to generate suggestions (${response.status})`);
      }

      const data = await response.json();
      setReplies(data.replies || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate suggestions";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [emailSubject, emailBody, emailSender, replyCount, userName]);

  // Fetch on mount and when email content changes
  React.useEffect(() => {
    if (emailSubject && emailBody) {
      fetchReplies();
    }
  }, [emailSubject, emailBody, fetchReplies]);

  // Handle reply selection
  const handleSelect = React.useCallback(
    (reply: SmartReplyItem) => {
      onReplySelect?.(reply);
    },
    [onReplySelect]
  );

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
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
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
            />
          </svg>
          Smart Replies
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <SmartReplySkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchReplies} />
        ) : replies.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No suggestions available for this email.
          </p>
        ) : (
          <div className="space-y-2">
            {replies.map((reply, index) => (
              <ReplyCard
                key={`${reply.tone}-${index}`}
                reply={reply}
                onSelect={() => handleSelect(reply)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
