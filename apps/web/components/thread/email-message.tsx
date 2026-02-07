"use client";

import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  FileText,
  Paperclip,
  Send,
} from "lucide-react";

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

interface EmailMessageProps {
  email: Email;
  isFirst: boolean;
  isLast: boolean;
}

export function EmailMessage({ email, isFirst, isLast }: EmailMessageProps) {
  const [isExpanded, setIsExpanded] = useState(isLast);
  const senderName = email.fromName || email.fromAddress;
  const senderInitial = senderName[0]?.toUpperCase() || "?";

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <Card className={cn("transition-shadow", isExpanded && "shadow-md")}>
      <CardHeader
        className="cursor-pointer py-3"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback
                className={cn(
                  "text-sm",
                  email.isSent
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {senderInitial}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{senderName}</span>
                {email.isSent && (
                  <Badge variant="secondary" className="text-xs">
                    <Send className="mr-1 h-3 w-3" />
                    Sent
                  </Badge>
                )}
                {email.isBot && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Bot className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>Automated message</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                To: {email.toAddresses.join(", ")}
                {email.ccAddresses.length > 0 && (
                  <span className="ml-2">
                    CC: {email.ccAddresses.join(", ")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {format(new Date(email.date), "MMM d, yyyy 'at' h:mm a")}
            </span>
            {email.attachments.length > 0 && (
              <Badge variant="outline" className="text-xs">
                <Paperclip className="mr-1 h-3 w-3" />
                {email.attachments.length}
              </Badge>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          {/* Email body */}
          {email.bodyHtml ? (
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
            />
          ) : (
            <div className="whitespace-pre-wrap text-sm">{email.bodyText}</div>
          )}

          {/* Attachments */}
          {email.attachments.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h4 className="mb-2 text-sm font-medium">Attachments</h4>
              <div className="flex flex-wrap gap-2">
                {email.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="max-w-[200px] truncate">
                      {attachment.filename}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({formatFileSize(attachment.size)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
