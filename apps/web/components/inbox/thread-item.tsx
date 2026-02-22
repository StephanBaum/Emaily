"use client";

import { useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useFormattedDate } from "@/hooks/use-formatted-date";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Archive,
  Bot,
  Clock,
  Crown,
  Forward,
  Inbox,
  Reply,
  ShieldQuestion,
  Sparkles,
  Trash2,
} from "lucide-react";
import { usePrefetchThread } from "@/hooks/use-thread-actions";
import { useOptimisticThreadActions } from "@/contexts/thread-updates-context";

interface ThreadEmail {
  id: string;
  fromAddress: string;
  fromName: string | null;
  bodyText: string;
  date: string;
  isSent?: boolean;
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
  senderTrustLevel?: string | null;
  hasSentReply: boolean;
  aiStatus: string;
  aiNeedsReply: boolean | null;
  lastActivityAt: string;
  emails: ThreadEmail[];
  tags: ThreadTag[];
  assignments: ThreadAssignment[];
  seenBy: { userId: string; lastSeenEmailId: string | null }[];
  _count?: {
    emails: number;
  };
}

interface ThreadItemProps {
  thread: Thread;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (threadId: string) => void;
}

const LOW_VALUE_TAGS = ["spam", "newsletter", "advertising", "notification", "marketing"];

export function ThreadItem({
  thread,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
}: ThreadItemProps) {
  const router = useRouter();
  const prefetch = usePrefetchThread();
  const prefetchedRef = useRef(false);
  const { formatDate } = useFormattedDate();
  const { updateStatus, deleteThread } = useOptimisticThreadActions(thread.id);

  const handleMouseEnter = useCallback(() => {
    if (!prefetchedRef.current) {
      prefetchedRef.current = true;
      prefetch(thread.id);
    }
  }, [prefetch, thread.id]);

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect?.(thread.id);
    },
    [onToggleSelect, thread.id]
  );

  const handleQuickAction = useCallback(
    (e: React.MouseEvent, action: () => void) => {
      e.preventDefault();
      e.stopPropagation();
      action();
    },
    []
  );

  const latestEmail = thread.emails[0];
  const counterpartEmail = thread.emails.find((e) => !e.isSent) || latestEmail;
  const senderName = counterpartEmail?.fromName || counterpartEmail?.fromAddress || "Unknown";
  const senderInitial = senderName[0]?.toUpperCase() || "?";
  const preview = latestEmail?.bodyText?.slice(0, 100) || "";

  const seenRecord = thread.seenBy[0];
  const hasBeenSeen = !!seenRecord;
  const hasNewEmails = hasBeenSeen && seenRecord.lastSeenEmailId !== latestEmail?.id;
  const isUnseen = !hasBeenSeen || hasNewEmails;

  const hasLowValueTag = thread.tags.some((t) =>
    LOW_VALUE_TAGS.includes(t.tag.name.toLowerCase())
  );
  const isAIResolved = thread.aiStatus === "processed" && thread.aiNeedsReply === false;
  const isAIHandled = hasLowValueTag || isAIResolved;

  const isTrashed = thread.status === "trashed";
  const isArchived = thread.status === "archived";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group/row relative" onMouseEnter={handleMouseEnter}>
          <Link
            href={`/thread/${thread.id}`}
            className={cn(
              "flex items-start gap-4 p-4 transition-colors hover:bg-muted/50 compact:gap-2 compact:p-2 compact:py-1.5",
              isUnseen && !isAIHandled && "border-l-2 border-l-blue-500 bg-blue-50 dark:bg-blue-950/30",
              isUnseen && isAIHandled && "bg-muted/30",
              !isUnseen && "border-l-2 border-l-transparent",
              isSelected && "bg-primary/10"
            )}
          >
            {/* Selection checkbox */}
            {isSelectionMode && (
              <div
                onClick={handleCheckboxClick}
                className="flex items-center justify-center self-center"
              >
                <div
                  className={cn(
                    "h-5 w-5 rounded border-2 transition-colors flex items-center justify-center",
                    isSelected
                      ? "bg-primary border-primary"
                      : "border-muted-foreground/30 hover:border-primary"
                  )}
                >
                  {isSelected && (
                    <svg
                      className="h-3 w-3 text-primary-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            )}

            <div className="relative">
              <Avatar className="h-10 w-10 compact:h-7 compact:w-7">
                <AvatarFallback
                  className={cn(
                    "text-sm compact:text-xs",
                    isUnseen && !isAIHandled
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {senderInitial}
                </AvatarFallback>
              </Avatar>
              {isUnseen && isAIHandled && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-muted-foreground/50" />
              )}
            </div>

            <div className="flex-1 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span
                    className={cn(
                      "truncate",
                      isUnseen && !isAIHandled ? "font-semibold" : "font-medium"
                    )}
                  >
                    {senderName}
                  </span>
                  {thread.senderTrustLevel === "stranger" && (
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <ShieldQuestion className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                        </TooltipTrigger>
                        <TooltipContent>Unknown sender</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {thread.senderTrustLevel === "vip" && (
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        </TooltipTrigger>
                        <TooltipContent>VIP contact</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {latestEmail?.fromAddress.includes("noreply") && (
                    <Bot className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground group-hover/row:hidden">
                  {formatDate(thread.lastActivityAt)}
                </span>

                {/* Hover quick actions */}
                <div
                  className={cn(
                    "hidden shrink-0 items-center gap-0.5",
                    "group-hover/row:flex",
                    "animate-in fade-in-0 slide-in-from-right-2 duration-150"
                  )}
                >
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={(e) => handleQuickAction(e, () => router.push(`/thread/${thread.id}?action=reply`))}
                        >
                          <Reply className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Reply</TooltipContent>
                    </Tooltip>

                    {isTrashed ? (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={(e) => handleQuickAction(e, () => updateStatus("open"))}
                            >
                              <Inbox className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Restore</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={(e) => handleQuickAction(e, deleteThread)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Delete permanently</TooltipContent>
                        </Tooltip>
                      </>
                    ) : (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={(e) => handleQuickAction(e, () => updateStatus("archived"))}
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Archive</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={(e) => handleQuickAction(e, () => updateStatus("trashed"))}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Trash</TooltipContent>
                        </Tooltip>
                      </>
                    )}
                  </TooltipProvider>
                </div>
              </div>

              <div className="mt-1 flex items-center gap-2">
                <span
                  className={cn(
                    "truncate",
                    isUnseen && !isAIHandled ? "font-medium" : "text-foreground"
                  )}
                >
                  {thread.subject}
                </span>
                {thread.hasSentReply && latestEmail?.isSent && (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Clock className="h-3 w-3 shrink-0 text-blue-500" />
                      </TooltipTrigger>
                      <TooltipContent>Awaiting reply</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {thread.hasSentReply && !latestEmail?.isSent && (
                  <Reply className="h-3 w-3 shrink-0 text-muted-foreground" />
                )}
                {thread._count && thread._count.emails > 1 && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    ({thread._count.emails})
                  </span>
                )}
              </div>

              <p className="mt-1 compact:mt-0.5 truncate text-sm text-muted-foreground">{preview}</p>

              {(thread.tags.length > 0 || thread.assignments.length > 0) && (
                <div className="mt-2 compact:mt-1 flex items-center gap-2">
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
        </div>
      </ContextMenuTrigger>

      {/* Right-click context menu */}
      <ContextMenuContent className="w-52">
        <ContextMenuItem onSelect={() => router.push(`/thread/${thread.id}`)}>
          Open
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => router.push(`/thread/${thread.id}?action=reply`)}>
          <Reply className="mr-2 h-4 w-4" />
          Reply
          <ContextMenuShortcut>R</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => router.push(`/thread/${thread.id}?action=forward`)}>
          <Forward className="mr-2 h-4 w-4" />
          Forward
          <ContextMenuShortcut>F</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />

        {isTrashed ? (
          <>
            <ContextMenuItem onSelect={() => updateStatus("open")}>
              <Inbox className="mr-2 h-4 w-4" />
              Restore to Inbox
            </ContextMenuItem>
            <ContextMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={deleteThread}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Permanently
            </ContextMenuItem>
          </>
        ) : (
          <>
            {isArchived ? (
              <ContextMenuItem onSelect={() => updateStatus("open")}>
                <Inbox className="mr-2 h-4 w-4" />
                Move to Inbox
              </ContextMenuItem>
            ) : (
              <ContextMenuItem onSelect={() => updateStatus("archived")}>
                <Archive className="mr-2 h-4 w-4" />
                Archive
                <ContextMenuShortcut>E</ContextMenuShortcut>
              </ContextMenuItem>
            )}
            <ContextMenuItem onSelect={() => updateStatus("snoozed")}>
              <Clock className="mr-2 h-4 w-4" />
              Snooze
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => updateStatus("trashed")}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Move to Trash
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
