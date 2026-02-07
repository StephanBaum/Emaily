"use client";

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
}

export function EmailChain({ emails }: EmailChainProps) {
  return (
    <div className="space-y-4 p-6">
      {emails.map((email, index) => (
        <EmailMessage
          key={email.id}
          email={email}
          isFirst={index === 0}
          isLast={index === emails.length - 1}
        />
      ))}
    </div>
  );
}
