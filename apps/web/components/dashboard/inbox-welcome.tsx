"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Archive, Tag, Pencil, Shield, Sparkles, CheckCircle2, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAISummary } from "@/hooks/use-ai-summary";
import { ThreadPill } from "./thread-pill";
import type { AISummaryAction, AISummaryGroup } from "@emaily/shared";

const ACTION_ICONS: Record<AISummaryAction, typeof Archive> = {
  ai_archived: Archive,
  ai_tagged: Tag,
  ai_draft_generated: Pencil,
  ai_auto_replied: Sparkles,
  ai_quarantined: Shield,
};

// Actions that represent "handled" items (less important to user)
const HANDLED_ACTIONS: AISummaryAction[] = ["ai_archived", "ai_quarantined"];

// Actions that represent "processed but still relevant"
const RELEVANT_ACTIONS: AISummaryAction[] = ["ai_tagged", "ai_draft_generated", "ai_auto_replied"];

interface InboxWelcomeProps {
  unprocessedCount: number;
  className?: string;
}

export function InboxWelcome({ unprocessedCount, className }: InboxWelcomeProps) {
  const { groups } = useAISummary({ hours: 24 });
  const [showHandled, setShowHandled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Split groups into relevant (drafts, replies, tagged) vs handled (archived, spam)
  const relevantGroups = groups.filter(g => RELEVANT_ACTIONS.includes(g.action));
  const handledGroups = groups.filter(g => HANDLED_ACTIONS.includes(g.action));

  const relevantCount = relevantGroups.reduce((sum, g) => sum + g.count, 0);
  const handledCount = handledGroups.reduce((sum, g) => sum + g.count, 0);

  // Determine greeting based on state
  const hasUnprocessed = unprocessedCount > 0;
  const hasRelevant = relevantCount > 0;
  const hasHandled = handledCount > 0;

  return (
    <div className={cn("px-6 py-8", className)}>
      {/* Main greeting */}
      <div className="mb-6">
        {hasUnprocessed ? (
          <>
            <h2 className="text-2xl font-semibold mb-2 flex items-center gap-3">
              <Mail className="h-7 w-7 text-primary" />
              You have {unprocessedCount} new {unprocessedCount === 1 ? "message" : "messages"}
            </h2>
            <p className="text-muted-foreground">
              These need your attention. We&apos;ve sorted them by importance.
            </p>
          </>
        ) : hasRelevant ? (
          <>
            <h2 className="text-2xl font-semibold mb-2 flex items-center gap-3">
              <Sparkles className="h-7 w-7 text-amber-500" />
              AI prepared {relevantCount} {relevantCount === 1 ? "item" : "items"} for you
            </h2>
            <p className="text-muted-foreground">
              Drafts ready for review, tagged conversations, and auto-replies sent.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold mb-2 flex items-center gap-3">
              <CheckCircle2 className="h-7 w-7 text-green-500" />
              All caught up!
            </h2>
            <p className="text-muted-foreground">
              No new messages need your attention right now.
            </p>
          </>
        )}
      </div>

      {/* AI-processed relevant items (drafts, tagged, replied) */}
      {hasRelevant && (
        <div className="mb-8">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Ready for review
          </h3>
          <div className="space-y-4">
            {relevantGroups.map((group) => (
              <RelevantGroupSection key={group.action} group={group} />
            ))}
          </div>
        </div>
      )}

      {/* Compact "AI handled" section for archived/spam */}
      {hasHandled && (
        <div className="border-t pt-4">
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
            <span>AI handled {handledCount} {handledCount === 1 ? "item" : "items"}</span>
            <span className="text-xs">(newsletters, spam, low-priority)</span>
          </Button>

          {showHandled && (
            <div className="mt-3 pl-6 space-y-3">
              {handledGroups.map((group) => (
                <HandledGroupSection key={group.action} group={group} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RelevantGroupSection({ group }: { group: AISummaryGroup }) {
  const Icon = ACTION_ICONS[group.action];

  const labels: Record<AISummaryAction, { title: string; desc: string }> = {
    ai_tagged: { title: "Tagged", desc: "Categorized for easy finding" },
    ai_draft_generated: { title: "Drafts ready", desc: "Review and send when ready" },
    ai_auto_replied: { title: "Auto-replied", desc: "Responses sent on your behalf" },
    ai_archived: { title: "Archived", desc: "" },
    ai_quarantined: { title: "Quarantined", desc: "" },
  };

  const { title, desc } = labels[group.action];

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{title}</span>
        <Badge variant="secondary" className="text-xs">{group.count}</Badge>
        {desc && <span className="text-xs text-muted-foreground">— {desc}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {group.items.map((item) => (
          <ThreadPill key={item.activityId} item={item} />
        ))}
      </div>
    </div>
  );
}

function HandledGroupSection({ group }: { group: AISummaryGroup }) {
  const Icon = ACTION_ICONS[group.action];

  const labels: Record<AISummaryAction, string> = {
    ai_archived: "Archived",
    ai_quarantined: "Moved to spam",
    ai_tagged: "Tagged",
    ai_draft_generated: "Drafted",
    ai_auto_replied: "Auto-replied",
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{labels[group.action]}</span>
        <Badge variant="outline" className="text-xs h-5">{group.count}</Badge>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {group.items.slice(0, 5).map((item) => (
          <ThreadPill key={item.activityId} item={item} className="text-xs py-1 px-2" />
        ))}
        {group.items.length > 5 && (
          <span className="text-xs text-muted-foreground self-center">
            +{group.items.length - 5} more
          </span>
        )}
      </div>
    </div>
  );
}
