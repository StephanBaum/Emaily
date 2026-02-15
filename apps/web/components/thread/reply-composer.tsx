"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, Paperclip, Send } from "lucide-react";
import { useSendEmail } from "@/hooks/use-send-email";
import { ComposerHeader } from "./composer-header";

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
  const [isExpanded, setIsExpanded] = useState(false);
  const [body, setBody] = useState("");

  // Get reply recipients from the last email
  const lastEmail = thread.emails[thread.emails.length - 1];
  const replyTo = lastEmail?.fromAddress || "";
  const replySubject = thread.subject.startsWith("Re:")
    ? thread.subject
    : `Re: ${thread.subject}`;

  const { sendEmail, isSending, sendError: error, setSendError: setError } = useSendEmail({
    threadId: thread.id,
    mailboxId: mailbox.id,
    onSuccess: () => {
      setBody("");
      setIsExpanded(false);
    },
  });

  async function handleSend() {
    await sendEmail({ to: [replyTo], subject: replySubject, body });
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
      <ComposerHeader
        replyTo={replyTo}
        onClose={() => {
          setIsExpanded(false);
          setBody("");
          setError(null);
        }}
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
