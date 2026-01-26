"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { EmailDetail, EmailCompose, type EmailDetailData, type ComposeMode, type OriginalEmail } from "@/components/email";
import { ThreadView, type ThreadData } from "@/components/email/thread-view";
import { type ThreadMessageData } from "@/components/email/thread-message";
import { ContentContainer } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";

/**
 * Fetch email by ID from the API
 */
async function fetchEmail(id: string): Promise<EmailDetailData> {
  const response = await fetch(`/api/emails/${id}`);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `Failed to fetch email: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch thread by threadId from the API
 */
async function fetchThread(threadId: string): Promise<ThreadData> {
  const response = await fetch(`/api/emails/threads/${threadId}`);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `Failed to fetch thread: ${response.statusText}`);
  }

  const emails: EmailDetailData[] = await response.json();

  // Transform emails into ThreadData format
  const participants = Array.from(
    new Set(
      emails.flatMap((email) => [
        email.sender,
        ...(email.recipients || []),
      ])
    )
  );

  const messages: ThreadMessageData[] = emails.map((email) => ({
    id: email.id,
    subject: email.subject,
    sender: email.sender,
    recipients: email.recipients || [],
    body: email.body,
    bodyHtml: email.bodyHtml,
    category: email.category || null,
    priority: email.priority || null,
    isRead: email.isRead || false,
    isStarred: email.isStarred || false,
    receivedAt: email.receivedAt,
  }));

  // Use first message's subject and threadId
  const firstEmail = emails[0];

  return {
    threadId,
    subject: firstEmail.subject,
    messages,
    participants,
    // Show AI summary only for threads with 5+ messages
    summary: emails.length >= 5 ? firstEmail.summary : null,
  };
}

/**
 * Update email properties via API
 */
async function updateEmail(
  id: string,
  data: { isRead?: boolean; isStarred?: boolean; category?: string | null }
): Promise<void> {
  const response = await fetch(`/api/emails/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || `Failed to update email: ${response.statusText}`);
  }
}

/**
 * Archive email via API
 */
async function archiveEmail(id: string): Promise<void> {
  const response = await fetch(`/api/emails/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category: "archived" }),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || `Failed to archive email: ${response.statusText}`);
  }
}

/**
 * Delete email via API
 */
async function deleteEmail(id: string): Promise<void> {
  const response = await fetch(`/api/emails/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || `Failed to delete email: ${response.statusText}`);
  }
}

/**
 * Send email via API
 */
async function sendEmail(data: {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  inReplyTo?: string;
}): Promise<void> {
  const response = await fetch("/api/emails/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || `Failed to send email: ${response.statusText}`);
  }
}

/**
 * Loading skeleton for email detail
 */
function EmailDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-muted" />
          <div className="h-6 w-64 rounded bg-muted" />
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-8 rounded bg-muted" />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="rounded-lg border p-4 space-y-4">
        {/* Sender info */}
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 rounded bg-muted" />
            <div className="h-4 w-32 rounded bg-muted" />
          </div>
          <div className="h-4 w-40 rounded bg-muted" />
        </div>

        {/* Body */}
        <div className="space-y-2 pt-4">
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-3/4 rounded bg-muted" />
          <div className="h-4 w-1/2 rounded bg-muted" />
        </div>
      </div>

      {/* Smart replies skeleton */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-muted" />
          <div className="h-5 w-24 rounded bg-muted" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-3 space-y-2">
            <div className="h-5 w-16 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-3/4 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Error state for failed email load
 */
function ErrorState({
  message,
  onRetry,
  onBack,
}: {
  message: string;
  onRetry?: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-4 mb-4">
        <svg
          className="h-8 w-8 text-red-600 dark:text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">
        Failed to load email
      </h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md">{message}</p>
      <div className="flex items-center gap-3">
        <Button onClick={onBack} variant="outline">
          Back to Inbox
        </Button>
        {onRetry && (
          <Button onClick={onRetry}>Try again</Button>
        )}
      </div>
    </div>
  );
}

/**
 * EmailDetailPage displays a single email with full content and actions.
 *
 * Features:
 * - Email content with HTML rendering
 * - AI-generated summary and smart reply suggestions
 * - Action toolbar (reply, forward, archive, delete, star)
 * - Email compose dialog for replies and forwards
 * - Keyboard shortcuts
 * - Auto-mark as read on view
 * - Session protection (redirects to login if not authenticated)
 */
export default function EmailDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();

  const emailId = params.id as string;

  // State
  const [email, setEmail] = React.useState<EmailDetailData | null>(null);
  const [thread, setThread] = React.useState<ThreadData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isActionLoading, setIsActionLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Compose dialog state
  const [isComposeOpen, setIsComposeOpen] = React.useState(false);
  const [composeMode, setComposeMode] = React.useState<ComposeMode>("reply");
  const [initialContent, setInitialContent] = React.useState<string | undefined>();

  // Fetch email or thread
  const loadEmail = React.useCallback(async () => {
    if (!emailId) return;

    setIsLoading(true);
    setError(null);
    setThread(null);
    setEmail(null);

    try {
      const fetchedEmail = await fetchEmail(emailId);

      // Check if email is part of a thread
      if (fetchedEmail.threadId) {
        // Fetch full thread
        const fetchedThread = await fetchThread(fetchedEmail.threadId);
        setThread(fetchedThread);

        // Mark all unread messages in thread as read
        const unreadMessageIds = fetchedThread.messages
          .filter((msg) => {
            const originalEmail = fetchedEmail;
            return msg.id === originalEmail.id && !originalEmail.isRead;
          })
          .map((msg) => msg.id);

        if (unreadMessageIds.length > 0) {
          try {
            await updateEmail(emailId, { isRead: true });
          } catch {
            // Silently ignore mark-as-read failures
          }
        }
      } else {
        // Show single email
        setEmail(fetchedEmail);

        // Auto-mark as read if unread
        if (!fetchedEmail.isRead) {
          try {
            await updateEmail(emailId, { isRead: true });
            setEmail((prev) => prev ? { ...prev, isRead: true } : prev);
          } catch {
            // Silently ignore mark-as-read failures
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load email");
    } finally {
      setIsLoading(false);
    }
  }, [emailId]);

  // Load email on mount
  React.useEffect(() => {
    if (status === "authenticated") {
      loadEmail();
    }
  }, [status, loadEmail]);

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // Handle close/back navigation
  const handleClose = React.useCallback(() => {
    router.push("/inbox");
  }, [router]);

  // Handle archive action
  const handleArchive = React.useCallback(async (id: string) => {
    setIsActionLoading(true);
    try {
      await archiveEmail(id);
      router.push("/inbox");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive email");
    } finally {
      setIsActionLoading(false);
    }
  }, [router]);

  // Handle delete action
  const handleDelete = React.useCallback(async (id: string) => {
    setIsActionLoading(true);
    try {
      await deleteEmail(id);
      router.push("/inbox");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete email");
    } finally {
      setIsActionLoading(false);
    }
  }, [router]);

  // Handle reply action
  const handleReply = React.useCallback(
    (_id: string, content?: string) => {
      setComposeMode("reply");
      setInitialContent(content);
      setIsComposeOpen(true);
    },
    []
  );

  // Handle forward action
  const handleForward = React.useCallback((_id: string) => {
    setComposeMode("forward");
    setInitialContent(undefined);
    setIsComposeOpen(true);
  }, []);

  // Handle toggle read/unread
  const handleToggleRead = React.useCallback(
    async (id: string, isRead: boolean) => {
      setIsActionLoading(true);
      try {
        await updateEmail(id, { isRead });
        setEmail((prev) => (prev ? { ...prev, isRead } : prev));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update email");
      } finally {
        setIsActionLoading(false);
      }
    },
    []
  );

  // Handle toggle star
  const handleToggleStar = React.useCallback(
    async (id: string, isStarred: boolean) => {
      setIsActionLoading(true);
      try {
        await updateEmail(id, { isStarred });
        setEmail((prev) => (prev ? { ...prev, isStarred } : prev));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update email");
      } finally {
        setIsActionLoading(false);
      }
    },
    []
  );

  // Handle send email
  const handleSend = React.useCallback(
    async (data: {
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      body: string;
      inReplyTo?: string;
    }) => {
      await sendEmail(data);
    },
    []
  );

  // Close compose dialog
  const handleCloseCompose = React.useCallback(() => {
    setIsComposeOpen(false);
    setInitialContent(undefined);
  }, []);

  // Handle thread archive
  const handleThreadArchive = React.useCallback(
    async (_threadId: string) => {
      setIsActionLoading(true);
      try {
        // Archive all messages in the thread
        if (thread) {
          for (const message of thread.messages) {
            await archiveEmail(message.id);
          }
        }
        router.push("/inbox");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to archive thread");
      } finally {
        setIsActionLoading(false);
      }
    },
    [thread, router]
  );

  // Handle thread delete
  const handleThreadDelete = React.useCallback(
    async (_threadId: string) => {
      setIsActionLoading(true);
      try {
        // Delete all messages in the thread
        if (thread) {
          for (const message of thread.messages) {
            await deleteEmail(message.id);
          }
        }
        router.push("/inbox");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete thread");
      } finally {
        setIsActionLoading(false);
      }
    },
    [thread, router]
  );

  // Handle message-level reply in thread
  const handleThreadReply = React.useCallback(
    (_messageId: string) => {
      setComposeMode("reply");
      setInitialContent(undefined);
      setIsComposeOpen(true);
    },
    []
  );

  // Handle message-level forward in thread
  const handleThreadForward = React.useCallback(
    (_messageId: string) => {
      setComposeMode("forward");
      setInitialContent(undefined);
      setIsComposeOpen(true);
    },
    []
  );

  // Handle message-level star toggle in thread
  const handleThreadToggleStar = React.useCallback(
    async (messageId: string, isStarred: boolean) => {
      setIsActionLoading(true);
      try {
        await updateEmail(messageId, { isStarred });
        // Update thread state
        setThread((prev) =>
          prev
            ? {
                ...prev,
                messages: prev.messages.map((msg) =>
                  msg.id === messageId ? { ...msg, isStarred } : msg
                ),
              }
            : prev
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update message");
      } finally {
        setIsActionLoading(false);
      }
    },
    []
  );

  // Create original email data for compose
  const originalEmail: OriginalEmail | undefined = React.useMemo(() => {
    if (email) {
      return {
        id: email.id,
        subject: email.subject,
        sender: email.sender,
        recipients: email.recipients,
        body: email.body,
        receivedAt: email.receivedAt,
      };
    }
    if (thread && thread.messages.length > 0) {
      // Use the latest message in the thread for compose context
      const latestMessage = thread.messages[thread.messages.length - 1];
      return {
        id: latestMessage.id,
        subject: thread.subject,
        sender: latestMessage.sender,
        recipients: latestMessage.recipients,
        body: latestMessage.body,
        receivedAt: latestMessage.receivedAt,
      };
    }
    return undefined;
  }, [email, thread]);

  // Show loading state while checking auth
  if (status === "loading") {
    return (
      <ContentContainer>
        <EmailDetailSkeleton />
      </ContentContainer>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (status === "unauthenticated") {
    return null;
  }

  // Show loading skeleton
  if (isLoading) {
    return (
      <ContentContainer className="p-0">
        <EmailDetailSkeleton />
      </ContentContainer>
    );
  }

  // Show error state
  if (error || (!email && !thread)) {
    return (
      <ContentContainer>
        <ErrorState
          message={error || "Email not found"}
          onRetry={loadEmail}
          onBack={handleClose}
        />
      </ContentContainer>
    );
  }

  // Show thread view if thread data is available
  if (thread) {
    return (
      <>
        <ContentContainer className="p-0 h-full">
          <ThreadView
            thread={thread}
            userName={session?.user?.name || undefined}
            onArchive={handleThreadArchive}
            onDelete={handleThreadDelete}
            onReply={handleThreadReply}
            onForward={handleThreadForward}
            onToggleStar={handleThreadToggleStar}
            onClose={handleClose}
            isLoading={isActionLoading}
            className="h-full"
          />
        </ContentContainer>

        {/* Email Compose Dialog */}
        <EmailCompose
          isOpen={isComposeOpen}
          onClose={handleCloseCompose}
          onSend={handleSend}
          mode={composeMode}
          originalEmail={originalEmail}
          initialContent={initialContent}
          userEmail={session?.user?.email || undefined}
          userName={session?.user?.name || undefined}
        />
      </>
    );
  }

  // Show single email view
  if (email) {
    return (
      <>
        <ContentContainer className="p-0 h-full">
          <EmailDetail
            email={email}
            userName={session?.user?.name || undefined}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onReply={handleReply}
            onForward={handleForward}
            onToggleRead={handleToggleRead}
            onToggleStar={handleToggleStar}
            onClose={handleClose}
            showSmartReplies={true}
            isLoading={isActionLoading}
            className="h-full"
          />
        </ContentContainer>

        {/* Email Compose Dialog */}
        <EmailCompose
          isOpen={isComposeOpen}
          onClose={handleCloseCompose}
          onSend={handleSend}
          mode={composeMode}
          originalEmail={originalEmail}
          initialContent={initialContent}
          userEmail={session?.user?.email || undefined}
          userName={session?.user?.name || undefined}
        />
      </>
    );
  }

  // Fallback (should not reach here)
  return null;
}
