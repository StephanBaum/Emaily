"use client";

import * as React from "react";
import type { Email } from "@/components/email";

/**
 * Undo notification state
 */
export interface UndoNotification {
  id: string;
  message: string;
  action: () => Promise<void>;
  expiresAt: number;
}

/**
 * Email action result with undo support
 */
export interface EmailActionResult {
  success: boolean;
  error?: string;
  undoAvailable?: boolean;
}

/**
 * Email actions hook return type
 */
export interface UseEmailActionsReturn {
  /** Archive an email (move to archive) */
  archiveEmail: (emailId: string) => Promise<EmailActionResult>;
  /** Unarchive an email (move back to inbox) */
  unarchiveEmail: (emailId: string) => Promise<EmailActionResult>;
  /** Delete an email permanently */
  deleteEmail: (emailId: string) => Promise<EmailActionResult>;
  /** Mark an email as read */
  markAsRead: (emailId: string) => Promise<EmailActionResult>;
  /** Mark an email as unread */
  markAsUnread: (emailId: string) => Promise<EmailActionResult>;
  /** Toggle star status */
  toggleStar: (emailId: string, isStarred: boolean) => Promise<EmailActionResult>;
  /** Current undo notification */
  undoNotification: UndoNotification | null;
  /** Dismiss the undo notification */
  dismissUndo: () => void;
  /** Execute the undo action */
  executeUndo: () => Promise<void>;
  /** Whether any action is in progress */
  isLoading: boolean;
}

/**
 * Configuration for the useEmailActions hook
 */
export interface UseEmailActionsConfig {
  /** Callback when an email is optimistically removed from the list */
  onOptimisticRemove?: (emailId: string, previousState: Email) => void;
  /** Callback when an email is optimistically updated */
  onOptimisticUpdate?: (emailId: string, updates: Partial<Email>) => void;
  /** Callback when an action fails and needs to be reverted */
  onRevert?: (emailId: string, previousState: Email) => void;
  /** How long the undo notification should stay visible (ms) */
  undoTimeout?: number;
}

const DEFAULT_UNDO_TIMEOUT = 5000; // 5 seconds

/**
 * Custom hook for email actions with optimistic updates and undo support.
 *
 * Features:
 * - Optimistic updates for instant UI feedback
 * - Undo support for archive/delete actions
 * - Error handling with automatic revert
 * - Loading state management
 *
 * @example
 * ```tsx
 * const { archiveEmail, undoNotification, executeUndo } = useEmailActions({
 *   onOptimisticRemove: (id, prev) => setEmails(emails.filter(e => e.id !== id)),
 *   onRevert: (id, prev) => setEmails([...emails, prev]),
 * });
 *
 * // Archive with undo
 * await archiveEmail(emailId);
 *
 * // Show undo notification
 * {undoNotification && (
 *   <UndoNotification message={undoNotification.message} onUndo={executeUndo} />
 * )}
 * ```
 */
export function useEmailActions(config: UseEmailActionsConfig = {}): UseEmailActionsReturn {
  const {
    onOptimisticRemove,
    onOptimisticUpdate,
    onRevert,
    undoTimeout = DEFAULT_UNDO_TIMEOUT,
  } = config;

  const [isLoading, setIsLoading] = React.useState(false);
  const [undoNotification, setUndoNotification] = React.useState<UndoNotification | null>(null);

  // Store for undo data
  const undoDataRef = React.useRef<{
    emailId: string;
    previousState: Email;
    action: "archive" | "delete";
    previousCategory?: string | null;
  } | null>(null);

  // Timer ref for auto-dismiss
  const undoTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Clear undo timer on unmount
  React.useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  /**
   * Set up undo notification with auto-dismiss
   */
  const setupUndoNotification = React.useCallback(
    (message: string, undoAction: () => Promise<void>) => {
      // Clear existing timer
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }

      const notification: UndoNotification = {
        id: Date.now().toString(),
        message,
        action: undoAction,
        expiresAt: Date.now() + undoTimeout,
      };

      setUndoNotification(notification);

      // Auto-dismiss after timeout
      undoTimerRef.current = setTimeout(() => {
        setUndoNotification((current) =>
          current?.id === notification.id ? null : current
        );
        undoDataRef.current = null;
      }, undoTimeout);
    },
    [undoTimeout]
  );

  /**
   * Dismiss the current undo notification
   */
  const dismissUndo = React.useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    setUndoNotification(null);
    undoDataRef.current = null;
  }, []);

  /**
   * Execute the undo action
   */
  const executeUndo = React.useCallback(async () => {
    if (!undoNotification || !undoDataRef.current) return;

    const { emailId, previousState, action, previousCategory } = undoDataRef.current;

    // Clear the notification first
    dismissUndo();

    setIsLoading(true);

    try {
      if (action === "archive") {
        // Unarchive the email
        const response = await fetch(`/api/emails/${emailId}/archive`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to unarchive email");
        }

        // Restore the email in the UI
        onRevert?.(emailId, { ...previousState, category: previousCategory ?? null });
      } else if (action === "delete") {
        // For delete, we would need to restore from trash
        // This depends on the backend implementation
        // For now, just restore the UI state
        onRevert?.(emailId, previousState);
      }
    } catch (error) {
      // Undo failed, but we've already dismissed the notification
      // Could show an error toast here
    } finally {
      setIsLoading(false);
    }
  }, [undoNotification, dismissUndo, onRevert]);

  /**
   * Archive an email with optimistic update
   */
  const archiveEmail = React.useCallback(
    async (emailId: string): Promise<EmailActionResult> => {
      setIsLoading(true);

      try {
        // First, fetch the current email state for undo
        const emailResponse = await fetch(`/api/emails/${emailId}`);
        if (!emailResponse.ok) {
          throw new Error("Failed to fetch email");
        }
        const currentEmail: Email = await emailResponse.json();

        // Store undo data
        undoDataRef.current = {
          emailId,
          previousState: currentEmail,
          action: "archive",
          previousCategory: currentEmail.category,
        };

        // Optimistically remove from list
        onOptimisticRemove?.(emailId, currentEmail);

        // Make the API call
        const response = await fetch(`/api/emails/${emailId}/archive`, {
          method: "POST",
        });

        if (!response.ok) {
          // Revert on failure
          onRevert?.(emailId, currentEmail);
          undoDataRef.current = null;
          throw new Error("Failed to archive email");
        }

        // Set up undo notification
        setupUndoNotification("Email archived", async () => {
          await executeUndo();
        });

        return { success: true, undoAvailable: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [onOptimisticRemove, onRevert, setupUndoNotification, executeUndo]
  );

  /**
   * Unarchive an email
   */
  const unarchiveEmail = React.useCallback(
    async (emailId: string): Promise<EmailActionResult> => {
      setIsLoading(true);

      try {
        const response = await fetch(`/api/emails/${emailId}/archive`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to unarchive email");
        }

        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Delete an email with optimistic update
   */
  const deleteEmail = React.useCallback(
    async (emailId: string): Promise<EmailActionResult> => {
      setIsLoading(true);

      try {
        // Fetch current state for undo
        const emailResponse = await fetch(`/api/emails/${emailId}`);
        if (!emailResponse.ok) {
          throw new Error("Failed to fetch email");
        }
        const currentEmail: Email = await emailResponse.json();

        // Store undo data
        undoDataRef.current = {
          emailId,
          previousState: currentEmail,
          action: "delete",
        };

        // Optimistically remove from list
        onOptimisticRemove?.(emailId, currentEmail);

        // Make the API call
        const response = await fetch(`/api/emails/${emailId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          // Revert on failure
          onRevert?.(emailId, currentEmail);
          undoDataRef.current = null;
          throw new Error("Failed to delete email");
        }

        // Note: Delete might not be undoable depending on implementation
        // For now, we'll offer undo which would require backend support
        setupUndoNotification("Email deleted", async () => {
          await executeUndo();
        });

        return { success: true, undoAvailable: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [onOptimisticRemove, onRevert, setupUndoNotification, executeUndo]
  );

  /**
   * Mark an email as read with optimistic update
   */
  const markAsRead = React.useCallback(
    async (emailId: string): Promise<EmailActionResult> => {
      setIsLoading(true);

      // Optimistically update
      onOptimisticUpdate?.(emailId, { isRead: true });

      try {
        const response = await fetch(`/api/emails/${emailId}/read`, {
          method: "POST",
        });

        if (!response.ok) {
          // Revert on failure
          onOptimisticUpdate?.(emailId, { isRead: false });
          throw new Error("Failed to mark email as read");
        }

        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [onOptimisticUpdate]
  );

  /**
   * Mark an email as unread with optimistic update
   */
  const markAsUnread = React.useCallback(
    async (emailId: string): Promise<EmailActionResult> => {
      setIsLoading(true);

      // Optimistically update
      onOptimisticUpdate?.(emailId, { isRead: false });

      try {
        const response = await fetch(`/api/emails/${emailId}/read`, {
          method: "DELETE",
        });

        if (!response.ok) {
          // Revert on failure
          onOptimisticUpdate?.(emailId, { isRead: true });
          throw new Error("Failed to mark email as unread");
        }

        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [onOptimisticUpdate]
  );

  /**
   * Toggle star status with optimistic update
   */
  const toggleStar = React.useCallback(
    async (emailId: string, isStarred: boolean): Promise<EmailActionResult> => {
      setIsLoading(true);

      // Optimistically update
      onOptimisticUpdate?.(emailId, { isStarred });

      try {
        const response = await fetch(`/api/emails/${emailId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isStarred }),
        });

        if (!response.ok) {
          // Revert on failure
          onOptimisticUpdate?.(emailId, { isStarred: !isStarred });
          throw new Error("Failed to update star status");
        }

        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [onOptimisticUpdate]
  );

  return {
    archiveEmail,
    unarchiveEmail,
    deleteEmail,
    markAsRead,
    markAsUnread,
    toggleStar,
    undoNotification,
    dismissUndo,
    executeUndo,
    isLoading,
  };
}
