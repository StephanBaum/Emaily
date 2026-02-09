"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bot, Paperclip, Reply, Sparkles } from "lucide-react";

interface ThreadEmail {
  id: string;
  fromAddress: string;
  fromName: string | null;
  bodyText: string;
  date: string;
}

interface ThreadTag {
  appliedBy?: string;
  tag: {
    id: string;
    name: string;
    color: string;
  };
}

interface ThreadAssignment {
  assignedTo: {
    id: string;
    name: string;
    email: string;
  };
}

interface Thread {
  id: string;
  subject: string;
  status: string;
  hasSentReply: boolean;
  lastActivityAt: string;
  emails: ThreadEmail[];
  tags: ThreadTag[];
  assignments: ThreadAssignment[];
  seenBy: { userId: string }[];
  _count?: {
    emails: number;
  };
}

interface ThreadItemProps {
  thread: Thread;
}

export function ThreadItem({ thread }: ThreadItemProps) {
  const latestEmail = thread.emails[0];
  const isUnread = thread.seenBy.length === 0;
  const senderName = latestEmail?.fromName || latestEmail?.fromAddress || "Unknown";
  const senderInitial = senderName[0]?.toUpperCase() || "?";
  const preview = latestEmail?.bodyText?.slice(0, 100) || "";

  return (
    <Link
      href={`/thread/${thread.id}`}
      className={cn(
        "flex items-start gap-4 p-4 transition-colors hover:bg-muted/50",
        isUnread && "bg-primary/5"
      )}
    >
      <Avatar className="h-10 w-10">
        <AvatarFallback
          className={cn(
            "text-sm",
            isUnread
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {senderInitial}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <span
              className={cn(
                "truncate",
                isUnread ? "font-semibold" : "font-medium"
              )}
            >
              {senderName}
            </span>
            {latestEmail?.fromAddress.includes("noreply") && (
              <Bot className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
          <span className="flex-shrink-0 text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(thread.lastActivityAt), {
              addSuffix: true,
            })}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <span
            className={cn(
              "truncate",
              isUnread ? "font-medium" : "text-foreground"
            )}
          >
            {thread.subject}
          </span>
          {thread.hasSentReply && (
            <Reply className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          )}
          {thread._count && thread._count.emails > 1 && (
            <span className="flex-shrink-0 text-xs text-muted-foreground">
              ({thread._count.emails})
            </span>
          )}
        </div>

        <p className="mt-1 truncate text-sm text-muted-foreground">{preview}</p>

        {(thread.tags.length > 0 || thread.assignments.length > 0) && (
          <div className="mt-2 flex items-center gap-2">
            {thread.tags.map(({ tag, appliedBy }) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="gap-1 text-xs"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color,
                  borderColor: tag.color,
                }}
              >
                {appliedBy === "ai" && (
                  <Sparkles className="h-2.5 w-2.5" />
                )}
                {tag.name}
              </Badge>
            ))}
            {thread.assignments.map((assignment) => (
              <div
                key={assignment.assignedTo.id}
                className="flex items-center gap-1 text-xs text-muted-foreground"
              >
                <Avatar className="h-4 w-4">
                  <AvatarFallback className="text-[10px]">
                    {assignment.assignedTo.name[0]}
                  </AvatarFallback>
                </Avatar>
                <span>{assignment.assignedTo.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
