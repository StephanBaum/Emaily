"use client";

import { useState, useEffect, useMemo } from "react";
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
  Clock,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAISummary } from "@/hooks/use-ai-summary";
import { useThreads } from "@/hooks/use-threads";
import { Skeleton } from "@/components/ui/skeleton";
import type { AISummaryAction, AISummaryGroup, Thread } from "@emailautomation/shared";

const ACTION_ICONS: Record<AISummaryAction, typeof Archive> = {
  ai_archived: Archive,
  ai_tagged: Tag,
  ai_draft_generated: Pencil,
  ai_auto_replied: MessageSquare,
  ai_quarantined: Shield,
};

// Actions that represent "processed but still relevant" - user should see these
// Ordered by importance: drafts first (need review), then tagged, then auto-replied
const RELEVANT_ACTIONS: AISummaryAction[] = ["ai_draft_generated", "ai_tagged", "ai_auto_replied"];

// Actions that represent "handled" items (less important to user)
const HANDLED_ACTIONS: AISummaryAction[] = ["ai_archived", "ai_quarantined"];

interface InboxDashboardProps {
  mailboxId?: string;
}

// Generate a natural summary of threads
function generateThreadsSummary(threads: Thread[]): string {
  if (threads.length === 0) return "";

  // Group by sender trust level
  const vipThreads = threads.filter(t => t.senderTrustLevel === "vip");
  const trustedThreads = threads.filter(t => t.senderTrustLevel === "trusted");
  const otherThreads = threads.filter(t => !["vip", "trusted"].includes(t.senderTrustLevel || ""));

  const parts: string[] = [];

  if (vipThreads.length > 0) {
    const names = [...new Set(vipThreads.map(t => t.emails?.[0]?.fromName || "VIP contact"))].slice(0, 2);
    parts.push(`${vipThreads.length} from VIP${vipThreads.length > 1 ? "s" : ""} (${names.join(", ")})`);
  }

  if (trustedThreads.length > 0) {
    parts.push(`${trustedThreads.length} from trusted contacts`);
  }

  if (otherThreads.length > 0 && parts.length < 2) {
    parts.push(`${otherThreads.length} other${otherThreads.length > 1 ? "s" : ""}`);
  }

  return parts.join(", ");
}

// Generate a summary for an AI action group
function generateGroupSummary(group: AISummaryGroup): string {
  const items = group.items;
  if (items.length === 0) return "";

  // Get unique senders
  const senders = [...new Set(items.map(i => i.senderName || i.senderEmail.split("@")[0]))];

  // Get unique tags
  const allTags = items.flatMap(i => i.tags.map(t => t.name));
  const uniqueTags = [...new Set(allTags)].slice(0, 3);

  switch (group.action) {
    case "ai_draft_generated":
      if (senders.length === 1) {
        return `Reply drafted for ${senders[0]}'s message`;
      }
      return `Replies drafted for messages from ${senders.slice(0, 2).join(", ")}${senders.length > 2 ? ` and ${senders.length - 2} more` : ""}`;

    case "ai_tagged":
      if (uniqueTags.length > 0) {
        return `Categorized as ${uniqueTags.join(", ")}`;
      }
      return `${items.length} conversations organized`;

    case "ai_auto_replied":
      return `Quick responses sent to ${senders.slice(0, 2).join(", ")}${senders.length > 2 ? ` and ${senders.length - 2} more` : ""}`;

    case "ai_archived":
      // Try to identify common patterns
      const subjects = items.map(i => i.subject.toLowerCase());
      const isNewsletter = subjects.some(s => s.includes("newsletter") || s.includes("digest") || s.includes("weekly"));
      const isNotification = subjects.some(s => s.includes("notification") || s.includes("alert") || s.includes("update"));

      if (isNewsletter) return "Newsletters and digests moved out of inbox";
      if (isNotification) return "Automated notifications archived";
      return `Low-priority messages from ${senders.slice(0, 2).join(", ")} archived`;

    case "ai_quarantined":
      return "Suspicious or spam messages quarantined for safety";

    default:
      return "";
  }
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

  // Generate summaries
  const threadsSummary = useMemo(() =>
    threads ? generateThreadsSummary(threads) : "",
    [threads]
  );

  if (!mounted) return null;

  const isLoading = aiLoading || threadsLoading;
  const unprocessedCount = threads?.length ?? 0;

  // Split AI groups into relevant vs handled, sorted by importance
  const relevantGroups = groups
    .filter((g) => RELEVANT_ACTIONS.includes(g.action))
    .sort((a, b) => RELEVANT_ACTIONS.indexOf(a.action) - RELEVANT_ACTIONS.indexOf(b.action));
  const handledGroups = groups.filter((g) => HANDLED_ACTIONS.includes(g.action));

  const relevantCount = relevantGroups.reduce((sum, g) => sum + g.count, 0);
  const handledCount = handledGroups.reduce((sum, g) => sum + g.count, 0);

  const hasUnprocessed = unprocessedCount > 0;
  const hasRelevant = relevantCount > 0;
  const hasHandled = handledCount > 0;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // All caught up state
  if (!hasUnprocessed && !hasRelevant && !hasHandled) {
    return (
      <div className="px-6 py-12 flex flex-col items-center justify-center text-center">
        <div className="rounded-full bg-green-500/10 p-4 mb-4">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">All caught up!</h2>
        <p className="text-muted-foreground max-w-md">
          No messages need your attention right now. New emails will appear here when they arrive.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Unprocessed threads section */}
      {hasUnprocessed && threads && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold">
                  {unprocessedCount} new {unprocessedCount === 1 ? "message" : "messages"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {threadsSummary || "Sorted by importance — VIP and trusted contacts first"}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y rounded-lg border bg-card">
              {threads.map((thread) => (
                <ThreadCard key={thread.id} thread={thread} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI-processed relevant items - full width sections */}
      {hasRelevant && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              AI Prepared for You
            </h3>
          </div>

          {relevantGroups.map((group) => (
            <RelevantSection key={group.action} group={group} />
          ))}
        </div>
      )}

      {/* Compact "AI handled" section */}
      {hasHandled && (
        <Card className="bg-muted/30 border-dashed">
          <CardHeader className="py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHandled(!showHandled)}
              className="h-auto w-full justify-start gap-2 px-0 py-0 font-normal text-muted-foreground hover:text-foreground hover:bg-transparent"
            >
              {showHandled ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Archive className="h-4 w-4" />
              <span className="font-medium">
                AI handled {handledCount} {handledCount === 1 ? "item" : "items"}
              </span>
              <span className="text-xs opacity-70 ml-1">
                — newsletters, notifications, spam
              </span>
            </Button>
          </CardHeader>

          {showHandled && (
            <CardContent className="pt-0 space-y-4">
              {handledGroups.map((group) => (
                <HandledSection key={group.action} group={group} />
              ))}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

function ThreadCard({ thread }: { thread: Thread }) {
  const latestEmail = thread.emails?.[0];
  const senderName = latestEmail?.fromName || latestEmail?.fromEmail?.split("@")[0] || "Unknown";
  const senderInitial = senderName[0]?.toUpperCase() || "?";
  const isVip = thread.senderTrustLevel === "vip";
  const isTrusted = thread.senderTrustLevel === "trusted";

  return (
    <Link
      href={`/thread/${thread.id}`}
      className="flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors"
    >
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className={cn(
          isVip ? "bg-amber-500/20 text-amber-600" :
          isTrusted ? "bg-blue-500/20 text-blue-600" :
          "bg-muted text-muted-foreground"
        )}>
          {senderInitial}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium truncate">{senderName}</span>
          {isVip && (
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 text-[10px] px-1.5 h-4">
              VIP
            </Badge>
          )}
          {isTrusted && (
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 text-[10px] px-1.5 h-4">
              Trusted
            </Badge>
          )}
        </div>
        <p className="text-sm truncate">{thread.subject}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {latestEmail?.textBody?.slice(0, 100) || "No preview available"}
        </p>
      </div>
      <div className="text-xs text-muted-foreground shrink-0">
        <Clock className="h-3 w-3 inline mr-1" />
        {formatRelativeTime(new Date(thread.lastActivityAt))}
      </div>
    </Link>
  );
}

function RelevantSection({ group }: { group: AISummaryGroup }) {
  const Icon = ACTION_ICONS[group.action];
  const summary = generateGroupSummary(group);

  const styles: Record<AISummaryAction, { border: string; iconBg: string; iconColor: string; accent: string }> = {
    ai_draft_generated: {
      border: "border-l-emerald-500",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600",
      accent: "text-emerald-600"
    },
    ai_tagged: {
      border: "border-l-blue-500",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600",
      accent: "text-blue-600"
    },
    ai_auto_replied: {
      border: "border-l-violet-500",
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-600",
      accent: "text-violet-600"
    },
    ai_archived: { border: "", iconBg: "", iconColor: "", accent: "" },
    ai_quarantined: { border: "", iconBg: "", iconColor: "", accent: "" },
  };

  const titles: Record<AISummaryAction, string> = {
    ai_draft_generated: "Drafts Ready",
    ai_tagged: "Organized",
    ai_auto_replied: "Auto-Replied",
    ai_archived: "Archived",
    ai_quarantined: "Quarantined",
  };

  const style = styles[group.action];

  return (
    <div className={cn("border-l-4 pl-4 py-2", style.border)}>
      {/* Summary header */}
      <div className="mb-3">
        <div className="flex items-center gap-3 mb-1">
          <div className={cn("rounded-lg p-1.5", style.iconBg)}>
            <Icon className={cn("h-4 w-4", style.iconColor)} />
          </div>
          <h4 className={cn("font-semibold", style.accent)}>{titles[group.action]}</h4>
          <Badge variant="secondary" className="text-xs h-5">
            {group.count}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{summary}</p>
      </div>

      {/* Email rows */}
      <div className="divide-y rounded-lg border bg-card">
        {group.items.map((item) => (
          <EmailRow key={item.activityId} item={item} action={group.action} />
        ))}
      </div>
    </div>
  );
}

function EmailRow({ item, action }: { item: AISummaryGroup["items"][0]; action: AISummaryAction }) {
  const senderName = item.senderName || item.senderEmail?.split("@")[0] || "Unknown";
  const senderInitial = senderName[0]?.toUpperCase() || "?";

  const actionBadges: Record<AISummaryAction, { label: string; className: string } | null> = {
    ai_draft_generated: { label: "Draft ready", className: "bg-emerald-500/10 text-emerald-600" },
    ai_tagged: null, // Tags are shown separately
    ai_auto_replied: { label: "Replied", className: "bg-violet-500/10 text-violet-600" },
    ai_archived: null,
    ai_quarantined: null,
  };

  const badge = actionBadges[action];

  return (
    <Link
      href={`/thread/${item.threadId}`}
      className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
    >
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarFallback className="bg-muted text-muted-foreground text-sm">
          {senderInitial}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{senderName}</span>
          {badge && (
            <Badge variant="secondary" className={cn("text-[10px] px-1.5 h-4 shrink-0", badge.className)}>
              {badge.label}
            </Badge>
          )}
        </div>
        <p className="text-sm truncate text-muted-foreground">{item.subject}</p>
      </div>
      {item.tags.length > 0 && (
        <div className="flex gap-1 shrink-0">
          {item.tags.slice(0, 2).map((tag) => (
            <Badge
              key={tag.name}
              variant="secondary"
              className="h-5 px-1.5 text-[10px] whitespace-nowrap"
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
              }}
            >
              {tag.name}
            </Badge>
          ))}
          {item.tags.length > 2 && (
            <span className="text-[10px] text-muted-foreground self-center">
              +{item.tags.length - 2}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

function HandledSection({ group }: { group: AISummaryGroup }) {
  const Icon = ACTION_ICONS[group.action];
  const summary = generateGroupSummary(group);

  const labels: Record<AISummaryAction, string> = {
    ai_archived: "Archived",
    ai_quarantined: "Quarantined",
    ai_tagged: "Tagged",
    ai_draft_generated: "Drafted",
    ai_auto_replied: "Auto-replied",
  };

  return (
    <div className="border-l-2 border-muted-foreground/20 pl-4 py-1">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{labels[group.action]}</span>
        <Badge variant="outline" className="text-xs h-5">
          {group.count}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-2">{summary}</p>
      <div className="flex flex-wrap gap-1.5">
        {group.items.map((item) => (
          <ThreadPill key={item.activityId} item={item} small />
        ))}
      </div>
    </div>
  );
}

function ThreadPill({
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
        small ? "px-2 py-0.5 max-w-[180px]" : "px-2.5 py-1 max-w-[220px]"
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
    </Link>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

function DashboardSkeleton() {
  return (
    <div className="px-6 py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-1/4 mb-2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
