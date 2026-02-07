"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Paperclip,
  Send,
  X,
  Lock,
  Unlock,
  History,
  FileEdit,
  Users,
} from "lucide-react";
import { DraftVersionHistory } from "./draft-version-history";

interface Mailbox {
  id: string;
  emailAddress: string;
  displayName: string | null;
}

interface Thread {
  id: string;
  subject: string;
  emails: {
    id: string;
    fromAddress: string;
    toAddresses: string[];
    ccAddresses: string[];
  }[];
}

interface SharedDraft {
  id: string;
  body: string;
  subject: string;
  status: string;
  toAddresses: string[];
  isLocked: boolean;
  isLockedByMe: boolean;
  lockedBy: { id: string; name: string; email: string } | null;
  createdBy: { id: string; name: string; email: string };
  lockExpiresAt: string | null;
}

interface SharedDraftComposerProps {
  thread: Thread;
  mailbox: Mailbox;
  existingDraft?: SharedDraft | null;
  onDraftCreated?: (draft: SharedDraft) => void;
  onDraftUpdated?: (draft: SharedDraft) => void;
}

// Debounce time for auto-save (30 seconds)
const AUTO_SAVE_DELAY = 30000;

export function SharedDraftComposer({
  thread,
  mailbox,
  existingDraft,
  onDraftCreated,
  onDraftUpdated,
}: SharedDraftComposerProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<SharedDraft | null>(existingDraft || null);
  const [isExpanded, setIsExpanded] = useState(!!existingDraft);
  const [body, setBody] = useState(existingDraft?.body || "");
  const [isSending, setIsSending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [lastSavedBody, setLastSavedBody] = useState(existingDraft?.body || "");

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveDraftRef = useRef<() => Promise<void>>();

  // Get reply recipients from the last email
  const lastEmail = thread.emails[thread.emails.length - 1];
  const replyTo = lastEmail?.fromAddress || "";
  const replySubject = thread.subject.startsWith("Re:")
    ? thread.subject
    : `Re: ${thread.subject}`;

  // Auto-save with debounce
  useEffect(() => {
    if (draft?.isLockedByMe && body !== lastSavedBody) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        if (saveDraftRef.current) {
          await saveDraftRef.current();
        }
      }, AUTO_SAVE_DELAY);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [body, draft?.isLockedByMe, lastSavedBody]);

  // Cleanup on unmount - release lock
  useEffect(() => {
    return () => {
      if (draft?.isLockedByMe) {
        // Fire and forget - release lock
        fetch(`/api/shared-drafts/${draft.id}/lock`, { method: "DELETE" });
      }
    };
  }, [draft?.id, draft?.isLockedByMe]);

  async function createDraft() {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/shared-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: thread.id,
          mailboxId: mailbox.id,
          subject: replySubject,
          toAddresses: [replyTo],
          body: "",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create draft");
      }

      const newDraft = await response.json();
      setDraft({
        ...newDraft,
        isLocked: true,
        isLockedByMe: true,
        lockedBy: null,
      });
      setIsExpanded(true);
      onDraftCreated?.(newDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create draft");
    } finally {
      setIsCreating(false);
    }
  }

  async function acquireLock() {
    if (!draft) return;

    setIsLocking(true);
    setError(null);

    try {
      const response = await fetch(`/api/shared-drafts/${draft.id}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockType: "editing" }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to acquire lock");
      }

      const updatedDraft = await response.json();
      setDraft(updatedDraft);
      setBody(updatedDraft.body);
      setLastSavedBody(updatedDraft.body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to acquire lock");
    } finally {
      setIsLocking(false);
    }
  }

  async function releaseLock() {
    if (!draft) return;

    // Save before releasing
    if (body !== lastSavedBody) {
      await saveDraft();
    }

    try {
      const response = await fetch(`/api/shared-drafts/${draft.id}/lock`, {
        method: "DELETE",
      });

      if (response.ok) {
        const updatedDraft = await response.json();
        setDraft(updatedDraft);
      }
    } catch (err) {
      // Ignore errors on release
    }
  }

  async function saveDraft() {
    if (!draft || !draft.isLockedByMe || isSaving) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/shared-drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });

      if (response.ok) {
        const updatedDraft = await response.json();
        setLastSavedBody(body);
        onDraftUpdated?.(updatedDraft);
      }
    } catch (err) {
      // Silent fail for auto-save
    } finally {
      setIsSaving(false);
    }
  }

  // Keep ref updated with latest saveDraft
  saveDraftRef.current = saveDraft;

  async function handleSend() {
    if (!body.trim() || !draft) return;

    // Save latest changes first
    if (body !== lastSavedBody) {
      await saveDraft();
    }

    setIsSending(true);
    setError(null);

    try {
      // Send the email
      const response = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: thread.id,
          mailboxId: mailbox.id,
          to: [replyTo],
          subject: replySubject,
          body: body.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send email");
      }

      // Mark draft as sent
      await fetch(`/api/shared-drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sent" }),
      });

      setBody("");
      setDraft(null);
      setIsExpanded(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setIsSending(false);
    }
  }

  function handleVersionRestore(newBody: string) {
    setBody(newBody);
    setShowHistory(false);
  }

  // No draft exists - show start draft button
  if (!draft && !isExpanded) {
    return (
      <div className="border-t p-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="flex-1 justify-start text-muted-foreground"
            onClick={() => setIsExpanded(true)}
          >
            Click to reply...
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={createDraft}
            disabled={isCreating}
          >
            {isCreating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Users className="mr-2 h-4 w-4" />
            )}
            Start Shared Draft
          </Button>
        </div>
      </div>
    );
  }

  // Starting a new draft (no shared draft yet)
  if (!draft && isExpanded) {
    return (
      <div className="border-t p-4">
        <p className="mb-3 text-sm text-muted-foreground">
          Create a shared draft for team collaboration, or reply directly.
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={createDraft}
            disabled={isCreating}
          >
            {isCreating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Users className="mr-2 h-4 w-4" />
            )}
            Start Shared Draft
          </Button>
          <Button variant="ghost" onClick={() => setIsExpanded(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Show version history
  if (showHistory && draft) {
    return (
      <div className="border-t">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <span className="text-sm font-medium">Version History</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <DraftVersionHistory
          draftId={draft.id}
          currentBody={body}
          onRestore={handleVersionRestore}
        />
      </div>
    );
  }

  // Draft exists - show composer
  return (
    <div className="border-t">
      {/* Header with lock status */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <FileEdit className="h-3 w-3" />
            Shared Draft
          </Badge>
          {draft?.isLocked && (
            <Badge
              variant={draft.isLockedByMe ? "default" : "destructive"}
              className="gap-1"
            >
              <Lock className="h-3 w-3" />
              {draft.isLockedByMe
                ? "You're editing"
                : `Locked by ${draft.lockedBy?.name}`}
            </Badge>
          )}
          {isSaving && (
            <span className="text-xs text-muted-foreground">Saving...</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowHistory(true)}
            title="Version history"
          >
            <History className="h-4 w-4" />
          </Button>
          {draft?.isLockedByMe ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={releaseLock}
              title="Release lock"
            >
              <Unlock className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={acquireLock}
              disabled={isLocking || (draft?.isLocked && !draft?.isLockedByMe)}
              title="Acquire lock to edit"
            >
              {isLocking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-2">
        <div className="text-sm text-muted-foreground">
          Replying to <span className="font-medium">{replyTo}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => {
            releaseLock();
            setIsExpanded(false);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Separator />

      <div className="p-4">
        <textarea
          className="min-h-[150px] w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-muted disabled:cursor-not-allowed"
          placeholder={
            draft?.isLockedByMe
              ? "Write your reply..."
              : "Acquire lock to edit..."
          }
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={!draft?.isLockedByMe}
          autoFocus={draft?.isLockedByMe}
        />

        {error && (
          <div className="mt-2 text-sm text-destructive">{error}</div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <Button variant="outline" size="sm" disabled>
            <Paperclip className="mr-2 h-4 w-4" />
            Attach
          </Button>

          <div className="flex items-center gap-2">
            {draft?.isLockedByMe && body !== lastSavedBody && (
              <Button
                variant="ghost"
                size="sm"
                onClick={saveDraft}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                releaseLock();
                setIsExpanded(false);
              }}
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!body.trim() || isSending || !draft?.isLockedByMe}
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
