"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Sparkles, X, Archive, Tag, Pencil, MessageSquare, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAISummary } from "@/hooks/use-ai-summary";
import { AISummaryGroup } from "./ai-summary-group";
import type { AISummaryAction } from "@emaily/shared";

const STORAGE_KEY_COLLAPSED = "ai-summary-panel-collapsed";
const STORAGE_KEY_DISMISSED_AT = "ai-summary-panel-dismissed-at";

const ACTION_ICONS: Record<AISummaryAction, typeof Archive> = {
  ai_archived: Archive,
  ai_tagged: Tag,
  ai_draft_generated: Pencil,
  ai_auto_replied: MessageSquare,
  ai_quarantined: Shield,
};

const ACTION_LABELS: Record<AISummaryAction, string> = {
  ai_archived: "Archived",
  ai_tagged: "Tagged",
  ai_draft_generated: "Drafted",
  ai_auto_replied: "Replied",
  ai_quarantined: "Quarantined",
};

interface AISummaryPanelProps {
  className?: string;
}

export function AISummaryPanel({ className }: AISummaryPanelProps) {
  const { groups, totalCount, since, isLoading } = useAISummary({ hours: 24 });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load collapsed state from localStorage
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY_COLLAPSED);
    if (stored !== null) {
      setIsCollapsed(stored === "true");
    }

    // Check if dismissed and if there's new activity since dismissal
    const dismissedAt = localStorage.getItem(STORAGE_KEY_DISMISSED_AT);
    if (dismissedAt && since) {
      const dismissedTime = new Date(dismissedAt).getTime();
      const sinceTime = new Date(since).getTime();
      // If no new activity since dismissal, keep dismissed
      // We check if the oldest activity in the window is still before dismissal
      setIsDismissed(dismissedTime > sinceTime);
    }
  }, [since]);

  // Persist collapsed state
  const handleToggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem(STORAGE_KEY_COLLAPSED, String(newState));
  };

  // Dismiss panel until new activity
  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(STORAGE_KEY_DISMISSED_AT, new Date().toISOString());
  };

  // Don't render on server or while loading initial state
  if (!mounted) {
    return null;
  }

  // Don't show if loading or no activity
  if (isLoading || totalCount === 0 || isDismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        "border-b bg-muted/30",
        className
      )}
    >
      <div className="flex items-center gap-3 px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleCollapse}
          className="h-auto gap-2 px-2 py-1 font-normal hover:bg-transparent shrink-0"
        >
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span className="font-medium">
            AI processed {totalCount} {totalCount === 1 ? "thread" : "threads"}
          </span>
          <span className="text-xs text-muted-foreground">
            (last 24h)
          </span>
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>

        {/* Compact action badges shown inline */}
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
          {groups.map((group) => {
            const Icon = ACTION_ICONS[group.action];
            return (
              <Badge
                key={group.action}
                variant="secondary"
                className="gap-1 shrink-0 text-xs font-normal"
              >
                <Icon className="h-3 w-3" />
                {ACTION_LABELS[group.action]} {group.count}
              </Badge>
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>

      {!isCollapsed && (
        <div className="space-y-1 px-4 pb-3">
          {groups.map((group) => (
            <AISummaryGroup
              key={group.action}
              group={group}
              defaultExpanded={groups.length === 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
