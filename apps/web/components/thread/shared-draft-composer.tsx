"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DraftVersionHistory, type LocalVersion } from "./draft-version-history";
import { ComposerHeader } from "./composer-header";
import { cn } from "@/lib/utils";
import { useAgents, type AgentData } from "@/hooks/use-agents";
import { getInitials } from "@/lib/format";
import { useSendEmail } from "@/hooks/use-send-email";

function DraftWithAIButton({
  agents,
  isLoading,
  onSelect,
  variant = "outline",
  align = "end",
}: {
  agents: AgentData[];
  isLoading: boolean;
  onSelect: (agentId: string) => void;
  variant?: "outline" | "secondary";
  align?: "start" | "end";
}) {
  if (agents.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Draft with AI
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {agents.map((agent) => (
          <DropdownMenuItem key={agent.id} onClick={() => onSelect(agent.id)}>
            <Sparkles className="mr-2 h-3.5 w-3.5 shrink-0" />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                {agent.name}
                {agent.isDefault && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    default
                  </Badge>
                )}
              </div>
              {agent.role && (
                <span className="text-[11px] text-muted-foreground">{agent.role}</span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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

// Auto-save delay (debounce before saving to server, no version)
const AUTO_SAVE_DELAY = 2000;
// Version delay (idle time before creating a version snapshot)
const VERSION_DELAY = 8000;
// Max local versions to keep in localStorage
const MAX_LOCAL_VERSIONS = 10;

function getPersonalDraftKey(threadId: string) {
  return `draft:personal:${threadId}`;
}

function getPersonalVersionsKey(threadId: string) {
  return `draft:personal:${threadId}:versions`;
}

function loadPersonalDraft(threadId: string): string {
  try {
    const raw = window.localStorage.getItem(getPersonalDraftKey(threadId));
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.body ?? "";
    }
  } catch {
    // Ignore parse errors
  }
  return "";
}

function savePersonalDraft(threadId: string, body: string) {
  try {
    window.localStorage.setItem(
      getPersonalDraftKey(threadId),
      JSON.stringify({ body, savedAt: Date.now() })
    );
  } catch {
    // Ignore storage errors
  }
}

function clearPersonalDraft(threadId: string) {
  try {
    window.localStorage.removeItem(getPersonalDraftKey(threadId));
    window.localStorage.removeItem(getPersonalVersionsKey(threadId));
  } catch {
    // Ignore
  }
}

function loadLocalVersions(threadId: string): LocalVersion[] {
  try {
    const raw = window.localStorage.getItem(getPersonalVersionsKey(threadId));
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }
  return [];
}

function addLocalVersion(threadId: string, body: string): LocalVersion[] {
  const versions = loadLocalVersions(threadId);
  const newVersion: LocalVersion = {
    id: `local-${Date.now()}`,
    bodySnapshot: body,
    createdAt: new Date().toISOString(),
  };
  const updated = [newVersion, ...versions].slice(0, MAX_LOCAL_VERSIONS);
  try {
    window.localStorage.setItem(getPersonalVersionsKey(threadId), JSON.stringify(updated));
  } catch {
    // Ignore
  }
  return updated;
}

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
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [lastSavedBody, setLastSavedBody] = useState(existingDraft?.body || "");
  const [localVersions, setLocalVersions] = useState<LocalVersion[]>([]);

  const { sendEmail, isSending, sendError, setSendError } = useSendEmail({
    threadId: thread.id,
    mailboxId: mailbox.id,
  });

  // Merge send errors with local errors for display
  const error = sendError || localError;
  function setError(e: string | null) {
    setLocalError(e);
    setSendError(null);
  }

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const versionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedIndicatorRef = useRef<NodeJS.Timeout | null>(null);
  const saveDraftRef = useRef<((skipVersion?: boolean) => Promise<void>) | undefined>(undefined);
  const lastDraftIdRef = useRef(existingDraft?.id ?? null);
  const draftPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSavedBodyRef = useRef(existingDraft?.body || "");
  const lastVersionedBodyRef = useRef(existingDraft?.body || "");

  // Load personal draft from localStorage on mount/expand
  useEffect(() => {
    if (isExpanded && mode === "personal" && !draft) {
      const saved = loadPersonalDraft(thread.id);
      if (saved && !body) {
        setBody(saved);
      }
      setLocalVersions(loadLocalVersions(thread.id));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, mode, draft, thread.id]);

  // Sync state when existingDraft prop changes (from router.refresh or server re-render)
  useEffect(() => {
    const newId = existingDraft?.id ?? null;
    if (newId && newId !== lastDraftIdRef.current) {
      lastDraftIdRef.current = newId;
      setDraft(existingDraft || null);
      setBody(existingDraft?.body || "");
      setLastSavedBody(existingDraft?.body || "");
      lastSavedBodyRef.current = existingDraft?.body || "";
      lastVersionedBodyRef.current = existingDraft?.body || "";
      setMode("shared");
      setIsExpanded(true);
      setIsAIEdited(false);
    } else if (existingDraft && existingDraft.body !== lastSavedBodyRef.current && !draft?.isLockedByMe) {
      // Draft content changed externally (e.g. different agent re-drafted)
      setDraft(existingDraft);
      setBody(existingDraft.body || "");
      setLastSavedBody(existingDraft.body || "");
      lastSavedBodyRef.current = existingDraft.body || "";
      lastVersionedBodyRef.current = existingDraft.body || "";
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

  // Show "Saved" indicator briefly
  const flashSaved = useCallback(() => {
    setShowSaved(true);
    if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current);
    savedIndicatorRef.current = setTimeout(() => setShowSaved(false), 2000);
  }, []);

  // Request the server to create a version snapshot of the current body
  // (used when the 2s save already persisted the body but we need a version entry)
  async function createVersionSnapshot() {
    if (!draft?.isLockedByMe) return;
    try {
      const response = await fetch(`/api/shared-drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createVersion: true }),
      });
      if (response.ok) {
        lastVersionedBodyRef.current = body;
        setHistoryRefreshKey((k) => k + 1);
      }
    } catch {
      // Silent fail
    }
  }

  // Two-timer auto-save for shared drafts:
  // - 2s debounce → save (skipVersion: true)
  // - 8s idle → create version snapshot
  useEffect(() => {
    if (draft?.isLockedByMe && body !== lastSavedBodyRef.current) {
      // Reset save timer (2s)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        if (saveDraftRef.current) {
          await saveDraftRef.current(true); // skipVersion
        }
      }, AUTO_SAVE_DELAY);

      // Reset version timer (8s)
      if (versionTimeoutRef.current) clearTimeout(versionTimeoutRef.current);
      versionTimeoutRef.current = setTimeout(async () => {
        // If body was already saved by the 2s timer, request a version snapshot
        // without re-sending the body (avoids the "no change" skip on server)
        if (body === lastSavedBodyRef.current) {
          await createVersionSnapshot();
        } else if (saveDraftRef.current) {
          await saveDraftRef.current(false); // save + version
        }
      }, VERSION_DELAY);
    }

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (versionTimeoutRef.current) clearTimeout(versionTimeoutRef.current);
    };
  }, [body, draft?.isLockedByMe]);

  // Personal mode: auto-save to localStorage + local version timer
  useEffect(() => {
    if (mode === "personal" && !draft && isExpanded && body) {
      // Save to localStorage on every change (debounced 2s)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        savePersonalDraft(thread.id, body);
        flashSaved();
      }, AUTO_SAVE_DELAY);

      // Create local version after 8s idle
      if (versionTimeoutRef.current) clearTimeout(versionTimeoutRef.current);
      if (body !== lastVersionedBodyRef.current && body.trim()) {
        versionTimeoutRef.current = setTimeout(() => {
          lastVersionedBodyRef.current = body;
          const updated = addLocalVersion(thread.id, body);
          setLocalVersions(updated);
        }, VERSION_DELAY);
      }
    }

    return () => {
      if (mode === "personal" && !draft) {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        if (versionTimeoutRef.current) clearTimeout(versionTimeoutRef.current);
      }
    };
  }, [body, mode, draft, isExpanded, thread.id, flashSaved]);

  // Auto-acquire lock when an existing shared draft is opened
  useEffect(() => {
    if (draft && isExpanded && mode === "shared" && !draft.isLockedByMe && !draft.isLocked) {
      acquireLock();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id, isExpanded, mode]);

  // Cleanup on unmount - release lock and save personal draft
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
      lastVersionedBodyRef.current = body || "";
      setIsExpanded(true);
      setMode("shared");
      // Clear personal draft since we're now shared
      clearPersonalDraft(thread.id);
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
      lastVersionedBodyRef.current = updatedDraft.body;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to acquire lock");
    } finally {
      setIsLocking(false);
    }
  }

  async function releaseLock() {
    if (!draft) return;

    // Save + version before releasing (if changed since last version)
    if (body !== lastSavedBodyRef.current) {
      await saveDraft(body !== lastVersionedBodyRef.current ? false : true);
    } else if (body !== lastVersionedBodyRef.current && body.trim()) {
      // Content was saved but no version yet — create one
      await saveDraft(false);
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

  async function saveDraft(skipVersion = false) {
    if (!draft || !draft.isLockedByMe || isSaving) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/shared-drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, skipVersion }),
      });

      if (response.ok) {
        const updatedDraft = await response.json();
        setLastSavedBody(body);
        lastSavedBodyRef.current = body;
        if (!skipVersion) {
          lastVersionedBodyRef.current = body;
          setHistoryRefreshKey((k) => k + 1);
        }
        flashSaved();
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

    const ok = await sendEmail({
      to: [replyTo],
      subject: replySubject,
      body,
      sharedDraftId: draft.id,
    });
    if (ok) {
      setBody("");
      setDraft(null);
      setIsExpanded(false);
    }
  }

  async function handlePersonalSend() {
    if (!body.trim()) return;

    const ok = await sendEmail({ to: [replyTo], subject: replySubject, body });
    if (ok) {
      setBody("");
      setIsExpanded(false);
      clearPersonalDraft(thread.id);
    }
  }

  function handleVersionRestore(newBody: string) {
    setBody(newBody);
    setShowHistory(false);
    // For personal mode, also save restored content to localStorage
    if (mode === "personal" && !draft) {
      savePersonalDraft(thread.id, newBody);
    }
  }

  async function handleCreateVersion() {
    if (draft?.isLockedByMe) {
      // Shared mode: save if needed, then create version on server
      if (body !== lastSavedBodyRef.current) {
        await saveDraft(false); // save + version
      } else {
        await createVersionSnapshot();
      }
    } else if (mode === "personal" && !draft && body.trim()) {
      // Personal mode: create local version
      lastVersionedBodyRef.current = body;
      const updated = addLocalVersion(thread.id, body);
      setLocalVersions(updated);
      savePersonalDraft(thread.id, body);
    }
    setHistoryRefreshKey((k) => k + 1);
  }

  function handlePersonalClose() {
    // Save to localStorage before closing (preserves content for later)
    if (body.trim()) {
      savePersonalDraft(thread.id, body);
      // Create version on close if changed since last version
      if (body !== lastVersionedBodyRef.current && body.trim()) {
        lastVersionedBodyRef.current = body;
        const updated = addLocalVersion(thread.id, body);
        setLocalVersions(updated);
      }
    }
    setIsExpanded(false);
    setError(null);
  }

  async function handleDraftWithAI(agentId: string) {
    setIsDraftingWithAI(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: thread.id, agentId, currentDraft: body || undefined }),
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
            lastVersionedBodyRef.current = newDraft.body || "";
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
          {!draft && (
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
          )}
          <DraftWithAIButton
            agents={activeAgents}
            isLoading={isDraftingWithAI}
            onSelect={handleDraftWithAI}
            variant="secondary"
            align="end"
          />
        </div>
      </div>
    );
  }

  // Show version history (personal or shared)
  if (showHistory && (draft || mode === "personal")) {
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
          draftId={draft?.id}
          localVersions={!draft ? localVersions : undefined}
          currentBody={body}
          onRestore={handleVersionRestore}
          onCreateVersion={handleCreateVersion}
          refreshKey={historyRefreshKey}
        />
      </div>
    );
  }

  // Personal reply mode (no shared draft)
  if (mode === "personal" && !draft) {
    return (
      <div className="border-t">
        <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
          <div className="flex items-center gap-2">
            {showSaved && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 animate-in fade-in duration-300">
                <Check className="h-3 w-3" />
                Saved
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
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

        <ComposerHeader
          replyTo={replyTo}
          onClose={handlePersonalClose}
        />

        <Separator />

        <div className="p-4">
          <textarea
            className="min-h-[150px] w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
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
              <DraftWithAIButton
                agents={activeAgents}
                isLoading={isDraftingWithAI}
                onSelect={handleDraftWithAI}
                align="start"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePersonalClose}
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
          {!isSaving && showSaved && (
            <span className="text-xs text-muted-foreground flex items-center gap-1 animate-in fade-in duration-300">
              <Check className="h-3 w-3" />
              Saved
            </span>
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

      <ComposerHeader
        replyTo={replyTo}
        onClose={() => {
          releaseLock();
          setIsExpanded(false);
        }}
      />

      <Separator />

      <div className="p-4">
        {lockedByOther ? (
          <div className="min-h-[100px] w-full rounded-md border bg-muted/50 px-3 py-2 text-sm whitespace-pre-wrap">
            {body || <span className="text-muted-foreground italic">Draft is empty</span>}
          </div>
        ) : (
          <textarea
            className={cn(
              "min-h-[150px] w-full resize-none rounded-md border px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-ring",
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
            {!lockedByOther && (
              <DraftWithAIButton
                agents={activeAgents}
                isLoading={isDraftingWithAI}
                onSelect={handleDraftWithAI}
                align="start"
              />
            )}
          </div>

          <div className="flex items-center gap-2">
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
