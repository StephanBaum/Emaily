"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { revalidateThreads } from "@/lib/revalidate";

interface Mailbox {
  id: string;
  emailAddress: string;
  displayName: string | null;
}

interface Email {
  id: string;
  fromAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
}

interface Thread {
  id: string;
  subject: string;
  emails: Email[];
}

interface ReplyComposerProps {
  thread: Thread;
  mailbox: Mailbox;
}

export function ReplyComposer({ thread, mailbox }: ReplyComposerProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get reply recipients from the last email
  const lastEmail = thread.emails[thread.emails.length - 1];
  const replyTo = lastEmail?.fromAddress || "";
  const replySubject = thread.subject.startsWith("Re:")
    ? thread.subject
    : `Re: ${thread.subject}`;

  async function handleSend() {
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

  if (!isExpanded) {
    return (
      <div className="border-t p-4">
        <Button
          variant="outline"
          className="w-full justify-start text-muted-foreground"
          onClick={() => setIsExpanded(true)}
        >
          Click to reply...
        </Button>
      </div>
    );
  }

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
          <Button variant="outline" size="sm" disabled>
            <Paperclip className="mr-2 h-4 w-4" />
            Attach
          </Button>

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
          </div>
        </div>
      </div>
    </div>
  );
}
