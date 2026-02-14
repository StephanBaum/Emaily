"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Archive,
  Tag,
  Pencil,
  Shield,
  Sparkles,
  CheckCircle2,
  Mail,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAISummary } from "@/hooks/use-ai-summary";
import { useThreads } from "@/hooks/use-threads";
import { ThreadItem } from "@/components/inbox/thread-item";
import { Skeleton } from "@/components/ui/skeleton";
import type { AISummaryAction, AISummaryGroup } from "@emailautomation/shared";

const ACTION_ICONS: Record<AISummaryAction, typeof Archive> = {
  ai_archived: Archive,
  ai_tagged: Tag,
  ai_draft_generated: Pencil,
  ai_auto_replied: MessageSquare,
  ai_quarantined: Shield,
};

// Actions that represent "processed but still relevant" - user should see these
const RELEVANT_ACTIONS: AISummaryAction[] = ["ai_tagged", "ai_draft_generated", "ai_auto_replied"];

// Actions that represent "handled" items (less important to user)
const HANDLED_ACTIONS: AISummaryAction[] = ["ai_archived", "ai_quarantined"];

interface InboxDashboardProps {
  mailboxId?: string;
}

export function InboxDashboard({ mailboxId }: InboxDashboardProps) {
  const { groups, isLoading: aiLoading } = useAISummary({ hours: 24 });
  const { threads, isLoading: threadsLoading } = useThreads({
    mailboxId,
    filter: "unprocessed",
  });
  const [showHandled, setShowHandled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isLoading = aiLoading || threadsLoading;
  const unprocessedCount = threads?.length ?? 0;

  // Split AI groups into relevant vs handled
  const relevantGroups = groups.filter((g) => RELEVANT_ACTIONS.includes(g.action));
  const handledGroups = groups.filter((g) => HANDLED_ACTIONS.includes(g.action));

  const relevantCount = relevantGroups.reduce((sum, g) => sum + g.count, 0);
  const handledCount = handledGroups.reduce((sum, g) => sum + g.count, 0);

  const hasUnprocessed = unprocessedCount > 0;
  const hasRelevant = relevantCount > 0;
  const hasHandled = handledCount > 0;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="px-6 py-6">
      {/* Main greeting section */}
      <div className="mb-6">
        {hasUnprocessed ? (
          <>
            <h2 className="text-2xl font-semibold mb-1 flex items-center gap-3">
              <Mail className="h-6 w-6 text-primary" />
              {unprocessedCount} new {unprocessedCount === 1 ? "message" : "messages"}
            </h2>
            <p className="text-muted-foreground text-sm">
              Sorted by importance — VIP and trusted contacts first
            </p>
          </>
        ) : hasRelevant ? (
          <>
            <h2 className="text-2xl font-semibold mb-1 flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-amber-500" />
              AI prepared {relevantCount} {relevantCount === 1 ? "item" : "items"}
            </h2>
            <p className="text-muted-foreground text-sm">
              Drafts ready, tagged conversations, and auto-replies
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold mb-1 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              All caught up!
            </h2>
            <p className="text-muted-foreground text-sm">
              No messages need your attention right now
            </p>
          </>
        )}
      </div>

      {/* Unprocessed threads - full width cards */}
      {hasUnprocessed && threads && (
        <div className="mb-6">
          <div className="divide-y border rounded-lg bg-card">
            {threads.map((thread) => (
              <ThreadItem key={thread.id} thread={thread} />
            ))}
          </div>
        </div>
      )}

      {/* AI-processed relevant items (drafts, tagged, replied) */}
      {hasRelevant && (
        <div className="mb-6">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            AI prepared for you
          </h3>
          <div className="space-y-4">
            {relevantGroups.map((group) => (
              <RelevantSection key={group.action} group={group} />
            ))}
          </div>
        </div>
      )}

      {/* Compact "AI handled" section for archived/spam */}
      {hasHandled && (
        <div className={cn("border-t pt-4", (hasUnprocessed || hasRelevant) && "mt-4")}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHandled(!showHandled)}
            className="h-auto gap-2 px-0 py-1 font-normal text-muted-foreground hover:text-foreground hover:bg-transparent"
          >
            {showHandled ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span>
              AI handled {handledCount} {handledCount === 1 ? "item" : "items"}
            </span>
            <span className="text-xs opacity-70">(newsletters, spam, low-priority)</span>
          </Button>

          {showHandled && (
            <div className="mt-3 space-y-3">
              {handledGroups.map((group) => (
                <HandledSection key={group.action} group={group} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RelevantSection({ group }: { group: AISummaryGroup }) {
  const Icon = ACTION_ICONS[group.action];

  const labels: Record<AISummaryAction, { title: string; desc: string }> = {
    ai_tagged: { title: "Tagged", desc: "Categorized for easy finding" },
    ai_draft_generated: { title: "Drafts ready", desc: "Review and send" },
    ai_auto_replied: { title: "Auto-replied", desc: "Sent on your behalf" },
    ai_archived: { title: "Archived", desc: "" },
    ai_quarantined: { title: "Quarantined", desc: "" },
  };

  const { title, desc } = labels[group.action];

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">{title}</span>
        <Badge variant="secondary" className="text-xs h-5">
          {group.count}
        </Badge>
        {desc && (
          <span className="text-xs text-muted-foreground">— {desc}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {group.items.map((item) => (
          <CompactThreadPill key={item.activityId} item={item} />
        ))}
      </div>
    </div>
  );
}

function HandledSection({ group }: { group: AISummaryGroup }) {
  const Icon = ACTION_ICONS[group.action];

  const labels: Record<AISummaryAction, string> = {
    ai_archived: "Archived",
    ai_quarantined: "Moved to spam",
    ai_tagged: "Tagged",
    ai_draft_generated: "Drafted",
    ai_auto_replied: "Auto-replied",
  };

  return (
    <div className="pl-6">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{labels[group.action]}</span>
        <Badge variant="outline" className="text-xs h-5">
          {group.count}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {group.items.slice(0, 6).map((item) => (
          <CompactThreadPill key={item.activityId} item={item} small />
        ))}
        {group.items.length > 6 && (
          <span className="text-xs text-muted-foreground self-center ml-1">
            +{group.items.length - 6} more
          </span>
        )}
      </div>
    </div>
  );
}

function CompactThreadPill({
  item,
  small,
}: {
  item: AISummaryGroup["items"][0];
  small?: boolean;
}) {
  const senderName = item.senderName || item.senderEmail || "Unknown";
  const senderInitial = senderName[0]?.toUpperCase() || "?";

  return (
    <Link
      href={`/thread/${item.threadId}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-background transition-colors hover:bg-muted/80",
        small ? "px-2 py-0.5 max-w-[200px]" : "px-2.5 py-1 max-w-[260px]"
      )}
    >
      <Avatar className={small ? "h-4 w-4" : "h-5 w-5"}>
        <AvatarFallback
          className={cn(
            "bg-muted text-muted-foreground",
            small ? "text-[8px]" : "text-[10px]"
          )}
        >
          {senderInitial}
        </AvatarFallback>
      </Avatar>
      <span className={cn("truncate", small ? "text-xs" : "text-sm")}>
        {item.subject}
      </span>
      {!small && item.tags.length > 0 && (
        <div className="flex gap-0.5 shrink-0">
          {item.tags.slice(0, 1).map((tag) => (
            <Badge
              key={tag.name}
              variant="secondary"
              className="h-4 px-1 text-[9px] whitespace-nowrap"
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
              }}
            >
              {tag.name}
            </Badge>
          ))}
          {item.tags.length > 1 && (
            <span className="text-[9px] text-muted-foreground">
              +{item.tags.length - 1}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-1/4 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
