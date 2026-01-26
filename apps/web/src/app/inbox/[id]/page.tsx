"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { EmailDetail, EmailCompose, type EmailDetailData, type ComposeMode, type OriginalEmail } from "@/components/email";
import { ContentContainer } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const [isLoading, setIsLoading] = React.useState(true);
  const [isActionLoading, setIsActionLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Compose dialog state
  const [isComposeOpen, setIsComposeOpen] = React.useState(false);
  const [composeMode, setComposeMode] = React.useState<ComposeMode>("reply");
  const [initialContent, setInitialContent] = React.useState<string | undefined>();

  // Fetch email
  const loadEmail = React.useCallback(async () => {
    if (!emailId) return;

    setIsLoading(true);
    setError(null);

    try {
      const fetchedEmail = await fetchEmail(emailId);
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
    (id: string, content?: string) => {
      setComposeMode("reply");
      setInitialContent(content);
      setIsComposeOpen(true);
    },
    []
  );

  // Handle forward action
  const handleForward = React.useCallback((id: string) => {
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

  // Create original email data for compose
  const originalEmail: OriginalEmail | undefined = email
    ? {
        id: email.id,
        subject: email.subject,
        sender: email.sender,
        recipients: email.recipients,
        body: email.body,
        receivedAt: email.receivedAt,
      }
    : undefined;

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
  if (error || !email) {
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
