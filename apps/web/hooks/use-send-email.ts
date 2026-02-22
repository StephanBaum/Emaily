"use client";

import { useState } from "react";
import { invalidateThreadCaches } from "@/lib/cache-utils";

interface SendEmailParams {
  to: string[];
  subject: string;
  body: string;
  sharedDraftId?: string;
}

export function useSendEmail(opts: {
  threadId: string;
  mailboxId: string;
  onSuccess?: () => void;
}) {
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  async function sendEmail(params: SendEmailParams): Promise<boolean> {
    if (!params.body.trim()) return false;

    setIsSending(true);
    setSendError(null);

    try {
      const response = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: opts.threadId,
          mailboxId: opts.mailboxId,
          to: params.to,
          subject: params.subject,
          body: params.body.trim(),
          ...(params.sharedDraftId ? { sharedDraftId: params.sharedDraftId } : {}),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send email");
      }

      // Elevate sender trust (fire-and-forget)
      if (params.to[0]) {
        fetch("/api/contacts/elevate-trust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipientAddress: params.to[0] }),
        }).catch(() => {});
      }

      // SWR revalidation instead of router.refresh()
      invalidateThreadCaches();
      opts.onSuccess?.();
      return true;
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send email");
      return false;
    } finally {
      setIsSending(false);
    }
  }

  return { sendEmail, isSending, sendError, setSendError };
}
