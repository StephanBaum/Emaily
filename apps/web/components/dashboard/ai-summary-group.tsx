"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Archive, Tag, Pencil, MessageSquare, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThreadPill } from "./thread-pill";
import type { AISummaryGroup as AISummaryGroupType, AISummaryAction } from "@emailautomation/shared";

interface AISummaryGroupProps {
  group: AISummaryGroupType;
  defaultExpanded?: boolean;
}

const ACTION_ICONS: Record<AISummaryAction, typeof Archive> = {
  ai_archived: Archive,
  ai_tagged: Tag,
  ai_draft_generated: Pencil,
  ai_auto_replied: MessageSquare,
  ai_quarantined: Shield,
};

const ACTION_COLORS: Record<AISummaryAction, string> = {
  ai_archived: "text-slate-500",
  ai_tagged: "text-blue-500",
  ai_draft_generated: "text-amber-500",
  ai_auto_replied: "text-green-500",
  ai_quarantined: "text-red-500",
};

export function AISummaryGroup({ group, defaultExpanded = false }: AISummaryGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const Icon = ACTION_ICONS[group.action];
  const colorClass = ACTION_COLORS[group.action];

  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="h-auto w-full justify-start gap-2 px-2 py-1.5 font-normal hover:bg-muted/50"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Icon className={cn("h-4 w-4", colorClass)} />
        <span className="font-medium">{group.label}</span>
        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
          {group.count}
        </Badge>
      </Button>

      {isExpanded && group.items.length > 0 && (
        <div className="ml-6 flex flex-wrap gap-2">
          {group.items.map((item) => (
            <ThreadPill key={item.activityId} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
