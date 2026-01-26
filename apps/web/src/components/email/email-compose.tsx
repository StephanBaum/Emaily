"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ComposeToolbar,
  DraftIntentDialog,
  type ComposeTone,
} from "./compose-toolbar";
import { cn } from "@/lib/utils";

/**
 * Compose mode - new email, reply, or forward
 */
export type ComposeMode = "new" | "reply" | "forward";

/**
 * Original email data for reply/forward
 */
export interface OriginalEmail {
  id: string;
  subject: string;
  sender: string;
  recipients: string[];
  body: string;
  receivedAt: Date | string;
}

export interface EmailComposeProps {
  /** Whether the compose dialog is open */
  isOpen: boolean;
  /** Called when the dialog should close */
  onClose: () => void;
  /** Called when email is sent */
  onSend: (data: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    inReplyTo?: string;
  }) => Promise<void>;
  /** Compose mode */
  mode?: ComposeMode;
  /** Original email for reply/forward */
  originalEmail?: OriginalEmail;
  /** Pre-filled content (e.g., from smart reply) */
  initialContent?: string;
  /** User's email address */
  userEmail?: string;
  /** User's display name */
  userName?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Icons for compose dialog
 */
const Icons = {
  send: (
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
        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
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
  discard: (
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
  minimize: (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  ),
  expand: (
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
        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
      />
    </svg>
  ),
  loading: (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  ),
  cc: (
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
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  ),
};

/**
 * Format date for quoted reply
 */
function formatQuoteDate(date: Date | string): string {
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
 * Generate reply subject from original
 */
function getReplySubject(subject: string): string {
  if (subject.toLowerCase().startsWith("re:")) {
    return subject;
  }
  return `Re: ${subject}`;
}

/**
 * Generate forward subject from original
 */
function getForwardSubject(subject: string): string {
  if (subject.toLowerCase().startsWith("fwd:")) {
    return subject;
  }
  return `Fwd: ${subject}`;
}

/**
 * Generate quoted original email body
 */
function getQuotedBody(email: OriginalEmail, mode: ComposeMode): string {
  if (mode === "new") return "";

  const prefix =
    mode === "reply"
      ? `\n\nOn ${formatQuoteDate(email.receivedAt)}, ${email.sender} wrote:`
      : `\n\n---------- Forwarded message ----------\nFrom: ${email.sender}\nDate: ${formatQuoteDate(email.receivedAt)}\nSubject: ${email.subject}\nTo: ${email.recipients.join(", ")}\n`;

  // Indent original body for reply
  const quotedBody =
    mode === "reply"
      ? email.body
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n")
      : email.body;

  return `${prefix}\n${quotedBody}`;
}

/**
 * Parse email addresses from input string
 */
function parseEmails(input: string): string[] {
  return input
    .split(/[,;]/)
    .map((email) => email.trim())
    .filter((email) => email.length > 0 && email.includes("@"));
}

/**
 * EmailCompose component provides a full-featured email composition interface.
 *
 * Features:
 * - New email, reply, and forward modes
 * - To, CC, BCC recipient fields
 * - Subject line input
 * - Rich text body with quoted replies
 * - AI-powered toolbar (enhance, draft, tone, subject generation)
 * - Keyboard shortcuts (Cmd/Ctrl+Enter to send, Escape to close)
 * - Loading states for send and AI operations
 */
export function EmailCompose({
  isOpen,
  onClose,
  onSend,
  mode = "new",
  originalEmail,
  initialContent,
  userEmail,
  userName,
  className,
}: EmailComposeProps) {
  // Form state
  const [to, setTo] = React.useState("");
  const [cc, setCc] = React.useState("");
  const [bcc, setBcc] = React.useState("");
  const [showCcBcc, setShowCcBcc] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [currentTone, setCurrentTone] = React.useState<ComposeTone | undefined>();

  // UI state
  const [isSending, setIsSending] = React.useState(false);
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const [showDraftDialog, setShowDraftDialog] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Refs
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  // Initialize form when dialog opens or mode changes
  React.useEffect(() => {
    if (isOpen) {
      // Reset error state
      setError(null);

      // Set recipients based on mode
      if (mode === "reply" && originalEmail) {
        setTo(originalEmail.sender);
        setSubject(getReplySubject(originalEmail.subject));
        setBody(initialContent || "");
      } else if (mode === "forward" && originalEmail) {
        setTo("");
        setSubject(getForwardSubject(originalEmail.subject));
        setBody(getQuotedBody(originalEmail, mode));
      } else {
        setTo("");
        setSubject("");
        setBody(initialContent || "");
      }

      // Reset other fields
      setCc("");
      setBcc("");
      setShowCcBcc(false);
      setCurrentTone(undefined);

      // Focus body for reply (to is pre-filled), otherwise focus to
      setTimeout(() => {
        if (mode === "reply" && bodyRef.current) {
          bodyRef.current.focus();
          bodyRef.current.setSelectionRange(0, 0);
        }
      }, 100);
    }
  }, [isOpen, mode, originalEmail, initialContent]);

  // Keyboard shortcuts
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+Enter to send
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
      // Escape to close (only if not in draft dialog)
      if (e.key === "Escape" && !showDraftDialog) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showDraftDialog, to, subject, body]);

  // Handle send
  const handleSend = async () => {
    // Validate recipients
    const toAddresses = parseEmails(to);
    if (toAddresses.length === 0) {
      setError("Please enter at least one recipient");
      return;
    }

    // Validate subject and body
    if (!subject.trim() && !body.trim()) {
      setError("Please enter a subject or message");
      return;
    }

    setError(null);
    setIsSending(true);

    try {
      await onSend({
        to: toAddresses,
        cc: parseEmails(cc),
        bcc: parseEmails(bcc),
        subject: subject.trim(),
        body: body.trim() + (originalEmail && mode !== "new" ? getQuotedBody(originalEmail, mode) : ""),
        inReplyTo: mode === "reply" && originalEmail ? originalEmail.id : undefined,
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send email";
      setError(message);
    } finally {
      setIsSending(false);
    }
  };

  // AI: Enhance draft
  const handleEnhance = async () => {
    if (!body.trim()) return;

    setIsAiLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "enhance",
          draft: body,
          subject: subject || undefined,
          recipient: to || undefined,
          targetTone: currentTone,
          fixGrammar: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `Failed to enhance (${response.status})`);
      }

      const data = await response.json();
      if (data.enhancedContent) {
        setBody(data.enhancedContent);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to enhance draft";
      setError(message);
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI: Draft from intent
  const handleDraft = async (intent: string, keyPoints?: string[]) => {
    setIsAiLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "draft",
          intent,
          subject: subject || undefined,
          recipient: to || undefined,
          keyPoints,
          tone: currentTone || "professional",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `Failed to draft (${response.status})`);
      }

      const data = await response.json();
      if (data.content) {
        setBody(data.content);
      }
      // Also set subject if generated
      if (data.subject && !subject.trim()) {
        setSubject(data.subject);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate draft";
      setError(message);
    } finally {
      setIsAiLoading(false);
      setShowDraftDialog(false);
    }
  };

  // AI: Adjust tone
  const handleAdjustTone = async (tone: ComposeTone) => {
    if (!body.trim()) return;

    setCurrentTone(tone);
    setIsAiLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "adjustTone",
          content: body,
          targetTone: tone,
          context: subject || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `Failed to adjust tone (${response.status})`);
      }

      const data = await response.json();
      if (data.adjustedContent) {
        setBody(data.adjustedContent);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to adjust tone";
      setError(message);
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI: Generate subject
  const handleGenerateSubject = async () => {
    if (!body.trim()) return;

    setIsAiLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "generateSubject",
          content: body,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `Failed to generate subject (${response.status})`);
      }

      const data = await response.json();
      if (data.subject) {
        setSubject(data.subject);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate subject";
      setError(message);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Determine dialog title
  const dialogTitle = React.useMemo(() => {
    switch (mode) {
      case "reply":
        return "Reply";
      case "forward":
        return "Forward";
      default:
        return "New Message";
    }
  }, [mode]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className={cn(
            "max-w-2xl h-[80vh] max-h-[700px] flex flex-col p-0",
            className
          )}
        >
          {/* Header */}
          <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <span>{dialogTitle}</span>
              {userName && (
                <Badge variant="outline" className="font-normal text-xs">
                  From: {userName}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Compose form */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Recipients */}
            <div className="px-4 py-2 border-b space-y-2">
              {/* To field */}
              <div className="flex items-center gap-2">
                <label htmlFor="to" className="text-sm font-medium w-12">
                  To:
                </label>
                <Input
                  id="to"
                  type="text"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className="flex-1 border-0 shadow-none focus-visible:ring-0 h-8 px-0"
                  disabled={isSending}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCcBcc(!showCcBcc)}
                  className="text-xs"
                >
                  {showCcBcc ? "Hide" : "Cc/Bcc"}
                </Button>
              </div>

              {/* CC/BCC fields */}
              {showCcBcc && (
                <>
                  <div className="flex items-center gap-2">
                    <label htmlFor="cc" className="text-sm font-medium w-12">
                      Cc:
                    </label>
                    <Input
                      id="cc"
                      type="text"
                      value={cc}
                      onChange={(e) => setCc(e.target.value)}
                      placeholder="cc@example.com"
                      className="flex-1 border-0 shadow-none focus-visible:ring-0 h-8 px-0"
                      disabled={isSending}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="bcc" className="text-sm font-medium w-12">
                      Bcc:
                    </label>
                    <Input
                      id="bcc"
                      type="text"
                      value={bcc}
                      onChange={(e) => setBcc(e.target.value)}
                      placeholder="bcc@example.com"
                      className="flex-1 border-0 shadow-none focus-visible:ring-0 h-8 px-0"
                      disabled={isSending}
                    />
                  </div>
                </>
              )}

              {/* Subject */}
              <div className="flex items-center gap-2">
                <label htmlFor="subject" className="text-sm font-medium w-12">
                  Subject:
                </label>
                <Input
                  id="subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter subject..."
                  className="flex-1 border-0 shadow-none focus-visible:ring-0 h-8 px-0"
                  disabled={isSending}
                />
              </div>
            </div>

            {/* AI Toolbar */}
            <div className="px-4 py-2 border-b bg-muted/30">
              <ComposeToolbar
                onEnhance={handleEnhance}
                onDraft={() => setShowDraftDialog(true)}
                onAdjustTone={handleAdjustTone}
                onGenerateSubject={handleGenerateSubject}
                isLoading={isAiLoading}
                currentTone={currentTone}
                hasContent={body.trim().length > 0}
                needsSubject={!subject.trim()}
              />
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 p-4">
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message..."
                className={cn(
                  "w-full h-full min-h-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm",
                  "ring-offset-background placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:opacity-50 resize-none"
                )}
                disabled={isSending || isAiLoading}
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Footer actions */}
            <div className="px-4 py-3 border-t flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Attach files"
                  disabled={isSending}
                >
                  {Icons.attachment}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  title="Discard draft"
                  disabled={isSending}
                >
                  {Icons.discard}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter to
                  send
                </span>
                <Button
                  onClick={handleSend}
                  disabled={isSending || isAiLoading}
                  className="gap-2"
                >
                  {isSending ? (
                    <>
                      {Icons.loading}
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      {Icons.send}
                      <span>Send</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Draft Intent Dialog */}
      <DraftIntentDialog
        isOpen={showDraftDialog}
        onClose={() => setShowDraftDialog(false)}
        onSubmit={handleDraft}
        isLoading={isAiLoading}
      />
    </>
  );
}

/**
 * Minimal compose button component for triggering compose dialog
 */
export interface ComposeButtonProps {
  onClick: () => void;
  className?: string;
}

export function ComposeButton({ onClick, className }: ComposeButtonProps) {
  return (
    <Button onClick={onClick} className={cn("gap-2", className)}>
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
          d="M12 4.5v15m7.5-7.5h-15"
        />
      </svg>
      <span>Compose</span>
    </Button>
  );
}
