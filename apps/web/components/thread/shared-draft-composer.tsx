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
  History,
  FileEdit,
  Users,
  Sparkles,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DraftVersionHistory } from "./draft-version-history";
import { cn } from "@/lib/utils";
import { useAgents } from "@/hooks/use-agents";
import { revalidateThreads } from "@/lib/revalidate";

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
  confidence?: Record<string, number> | null;
  lockType?: string | null;
  agentName?: string | null;
  onDraftCreated?: (draft: SharedDraft) => void;
  onDraftUpdated?: (draft: SharedDraft) => void;
}

// Debounce time for auto-save (30 seconds)
const AUTO_SAVE_DELAY = 30000;

export function SharedDraftComposer({
  thread,
  mailbox,
  existingDraft,
  confidence,
  lockType,
  agentName: initialAgentName,
  onDraftCreated,
  onDraftUpdated,
}: SharedDraftComposerProps) {
  const router = useRouter();
  const isAIDraft = lockType === "generating";
  const overallConfidence = confidence?.overall ?? null;
  const { agents } = useAgents();
  const activeAgents = agents?.filter((a) => a.active) ?? [];
  const [isDraftingWithAI, setIsDraftingWithAI] = useState(false);
  const [draft, setDraft] = useState<SharedDraft | null>(existingDraft || null);
  const [isExpanded, setIsExpanded] = useState(!!existingDraft);
  const [mode, setMode] = useState<"personal" | "shared">(
    existingDraft ? "shared" : "personal"
  );
  const [isAIEdited, setIsAIEdited] = useState(false);
  const [body, setBody] = useState(existingDraft?.body || "");
  const [isSending, setIsSending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [lastSavedBody, setLastSavedBody] = useState(existingDraft?.body || "");

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveDraftRef = useRef<() => Promise<void>>();
  const lastDraftIdRef = useRef(existingDraft?.id ?? null);
  const draftPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSavedBodyRef = useRef(existingDraft?.body || "");

  // Sync state when existingDraft prop changes (from router.refresh or server re-render)
  useEffect(() => {
    const newId = existingDraft?.id ?? null;
    if (newId && newId !== lastDraftIdRef.current) {
      lastDraftIdRef.current = newId;
      setDraft(existingDraft || null);
      setBody(existingDraft?.body || "");
      setLastSavedBody(existingDraft?.body || "");
      lastSavedBodyRef.current = existingDraft?.body || "";
      setMode("shared");
      setIsExpanded(true);
      setIsAIEdited(false);
    } else if (existingDraft && existingDraft.body !== lastSavedBodyRef.current && !draft?.isLockedByMe) {
      // Draft content changed externally (e.g. different agent re-drafted)
      setDraft(existingDraft);
      setBody(existingDraft.body || "");
      setLastSavedBody(existingDraft.body || "");
      lastSavedBodyRef.current = existingDraft.body || "";
      setIsAIEdited(false);
    }
  }, [existingDraft?.id, existingDraft?.body]);

  // Clean up draft poll on unmount
  useEffect(() => {
    return () => {
      if (draftPollRef.current) clearInterval(draftPollRef.current);
    };
  }, []);

  // Get reply recipients from the last email
  const lastEmail = thread.emails[thread.emails.length - 1];
  const replyTo = lastEmail?.fromAddress || "";
  const replySubject = thread.subject.startsWith("Re:")
    ? thread.subject
    : `Re: ${thread.subject}`;

  // Auto-save with debounce
  // Use ref for lastSavedBody comparison to avoid effect re-running when save completes
  useEffect(() => {
    if (draft?.isLockedByMe && body !== lastSavedBodyRef.current) {
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
  }, [body, draft?.isLockedByMe]);

  // Auto-acquire lock when an existing shared draft is opened
  useEffect(() => {
    if (draft && isExpanded && mode === "shared" && !draft.isLockedByMe && !draft.isLocked) {
      acquireLock();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id, isExpanded, mode]);

  // Cleanup on unmount - release lock
  useEffect(() => {
    return () => {
      if (draft?.isLockedByMe) {
        // Fire and forget - release lock
        fetch(`/api/shared-drafts/${draft.id}/lock`, { method: "DELETE" });
      }
    };
  }, [draft?.id, draft?.isLockedByMe]);

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

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
          body: body || "",
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
      setLastSavedBody(body || "");
      lastSavedBodyRef.current = body || "";
      setIsExpanded(true);
      setMode("shared");
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
      lastSavedBodyRef.current = updatedDraft.body;
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
        lastSavedBodyRef.current = body;
        setHistoryRefreshKey((k) => k + 1);
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

      // Elevate sender trust (fire-and-forget)
      fetch("/api/contacts/elevate-trust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientAddress: replyTo }),
      }).catch(() => {});

      setBody("");
      setDraft(null);
      setIsExpanded(false);
      revalidateThreads();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setIsSending(false);
    }
  }

  async function handlePersonalSend() {
    if (!body.trim()) return;

    setIsSending(true);
    setError(null);

    try {
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

      // Elevate sender trust (fire-and-forget)
      fetch("/api/contacts/elevate-trust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientAddress: replyTo }),
      }).catch(() => {});

      setBody("");
      setIsExpanded(false);
      revalidateThreads();
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

  async function handleDraftWithAI(agentId: string) {
    setIsDraftingWithAI(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: thread.id, agentId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "AI processing failed");
        return;
      }

      const aiResult = data.result;
      if (aiResult?.error) {
        setError(`AI error: ${aiResult.error}`);
        return;
      }

      // If a draft was generated, fetch it directly and apply to composer
      if (aiResult?.draft && aiResult?.draftId) {
        try {
          const draftRes = await fetch(`/api/shared-drafts/${aiResult.draftId}`);
          if (draftRes.ok) {
            const newDraft = await draftRes.json();
            lastDraftIdRef.current = newDraft.id;
            setDraft({
              ...newDraft,
              isLocked:
                !!newDraft.lockedById &&
                !!newDraft.lockExpiresAt &&
                new Date(newDraft.lockExpiresAt) > new Date(),
              isLockedByMe: false,
              lockedBy: null,
              lockExpiresAt: newDraft.lockExpiresAt,
            });
            setBody(newDraft.body || "");
            setLastSavedBody(newDraft.body || "");
            lastSavedBodyRef.current = newDraft.body || "";
            setMode("shared");
            setIsExpanded(true);
            setIsAIEdited(false);
          }
        } catch {
          // Fallback: poll for the draft via router refresh
        }
      }

      // Also refresh the page to update activity panel and other data
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to draft with AI");
    } finally {
      setIsDraftingWithAI(false);
    }
  }

  // Collapsed state - show reply prompt and shared draft button
  if (!isExpanded) {
    return (
      <div className="border-t p-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="flex-1 justify-start text-muted-foreground"
            onClick={() => {
              setMode("personal");
              setIsExpanded(true);
            }}
          >
            Click to reply...
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setMode("shared");
              createDraft();
            }}
            disabled={isCreating}
          >
            {isCreating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Users className="mr-2 h-4 w-4" />
            )}
            Start Shared Draft
          </Button>
          {activeAgents.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isDraftingWithAI}
                >
                  {isDraftingWithAI ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Draft with AI
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {activeAgents.map((agent) => (
                  <DropdownMenuItem
                    key={agent.id}
                    onClick={() => handleDraftWithAI(agent.id)}
                  >
                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                    {agent.name}
                    {agent.isDefault && (
                      <Badge variant="secondary" className="ml-2 text-[10px] px-1 py-0">
                        default
                      </Badge>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    );
  }

  // Personal reply mode (no shared draft)
  if (mode === "personal" && !draft) {
    return (
      <div className="border-t">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="text-sm text-muted-foreground">
            Replying to <span className="font-medium">{replyTo}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              setIsExpanded(false);
              setBody("");
              setError(null);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Separator />

        <div className="p-4">
          <textarea
            className="min-h-[150px] w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Write your reply..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            autoFocus
          />

          {error && (
            <div className="mt-2 text-sm text-destructive">{error}</div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                <Paperclip className="mr-2 h-4 w-4" />
                Attach
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMode("shared");
                  createDraft();
                }}
                disabled={isCreating}
              >
                {isCreating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Users className="mr-2 h-4 w-4" />
                )}
                Share Draft
              </Button>
              {activeAgents.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isDraftingWithAI}
                    >
                      {isDraftingWithAI ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Draft with AI
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {activeAgents.map((agent) => (
                      <DropdownMenuItem
                        key={agent.id}
                        onClick={() => handleDraftWithAI(agent.id)}
                      >
                        <Sparkles className="mr-2 h-3.5 w-3.5" />
                        {agent.name}
                        {agent.isDefault && (
                          <Badge variant="secondary" className="ml-2 text-[10px] px-1 py-0">
                            default
                          </Badge>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsExpanded(false);
                  setBody("");
                  setError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handlePersonalSend}
                disabled={!body.trim() || isSending}
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
          refreshKey={historyRefreshKey}
        />
      </div>
    );
  }

  const lockedByOther = draft?.isLocked && !draft?.isLockedByMe;

  // Draft exists - show composer
  return (
    <div className="border-t">
      {/* Header with shared draft badge and editor info */}
      <div className={cn(
        "flex items-center justify-between px-4 py-2",
        isAIDraft && !isAIEdited ? "bg-emerald-50/50 dark:bg-emerald-950/20" : "bg-muted/30"
      )}>
        <div className="flex items-center gap-2">
          {isAIDraft && !isAIEdited ? (
            <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200">
              <Sparkles className="h-3 w-3" />
              {initialAgentName || "AI Draft"}{overallConfidence !== null ? ` \u00b7 ${Math.round(overallConfidence * 100)}%` : ""}
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <FileEdit className="h-3 w-3" />
              Shared Draft
            </Badge>
          )}
          {isSaving && (
            <span className="text-xs text-muted-foreground">Saving...</span>
          )}
          {isLocking && (
            <span className="text-xs text-muted-foreground">
              <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
              Connecting...
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Show who's editing via avatar */}
          {lockedByOther && draft.lockedBy && (
            <div className="flex items-center gap-1.5 mr-1" title={`${draft.lockedBy.name} is editing`}>
              <Avatar className="h-6 w-6 ring-2 ring-orange-400">
                <AvatarFallback className="text-[10px] bg-orange-100 text-orange-700">
                  {getInitials(draft.lockedBy.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">
                {draft.lockedBy.name} is editing
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setHistoryRefreshKey((k) => k + 1);
              setShowHistory(true);
            }}
            title="Version history"
          >
            <History className="h-4 w-4" />
          </Button>
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
        {lockedByOther ? (
          <div className="min-h-[100px] w-full rounded-md border bg-muted/50 px-3 py-2 text-sm whitespace-pre-wrap">
            {body || <span className="text-muted-foreground italic">Draft is empty</span>}
          </div>
        ) : (
          <textarea
            className={cn(
              "min-h-[150px] w-full resize-none rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
              isAIDraft && !isAIEdited
                ? "bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200"
                : "bg-background"
            )}
            placeholder="Write your reply..."
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (isAIDraft && !isAIEdited) setIsAIEdited(true);
            }}
            autoFocus
          />
        )}

        {error && (
          <div className="mt-2 text-sm text-destructive">{error}</div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              <Paperclip className="mr-2 h-4 w-4" />
              Attach
            </Button>
            {activeAgents.length > 0 && !lockedByOther && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isDraftingWithAI}
                  >
                    {isDraftingWithAI ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Draft with AI
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {activeAgents.map((agent) => (
                    <DropdownMenuItem
                      key={agent.id}
                      onClick={() => handleDraftWithAI(agent.id)}
                    >
                      <Sparkles className="mr-2 h-3.5 w-3.5" />
                      {agent.name}
                      {agent.isDefault && (
                        <Badge variant="secondary" className="ml-2 text-[10px] px-1 py-0">
                          default
                        </Badge>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

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
            {!lockedByOther && (
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!body.trim() || isSending}
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
