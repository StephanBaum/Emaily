"use client";

import { ArchiveRestore } from "lucide-react";
import { EmailMessage } from "./email-message";

interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
}

interface Email {
  id: string;
  messageId: string;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  date: Date;
  isBot: boolean;
  isSent: boolean;
  attachments: Attachment[];
}

interface EmailChainProps {
  emails: Email[];
  reopenedTimestamps?: Date[];
}

export function EmailChain({ emails, reopenedTimestamps = [] }: EmailChainProps) {
  // Build a set of email indices that should have a reopen divider before them.
  // A divider goes before the first email whose date is >= a reopen timestamp.
  const dividerBeforeIndices = new Set<number>();
  for (const reopenedAt of reopenedTimestamps) {
    const ts = new Date(reopenedAt).getTime();
    const idx = emails.findIndex((e) => new Date(e.date).getTime() >= ts);
    if (idx > 0) {
      dividerBeforeIndices.add(idx);
    }
  }

  return (
    <div className="space-y-4 p-6 compact:space-y-2 compact:p-4">
      {emails.map((email, index) => (
        <div key={email.id}>
          {dividerBeforeIndices.has(index) && (
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <div className="flex items-center gap-1.5">
                <ArchiveRestore className="h-3 w-3" />
                <span>Previously archived</span>
              </div>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}
          <EmailMessage
            email={email}
            isFirst={index === 0}
            isLast={index === emails.length - 1}
          />
        </div>
      ))}
    </div>
  );
}
