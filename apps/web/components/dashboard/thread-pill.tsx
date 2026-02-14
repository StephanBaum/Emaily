"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AISummaryItem } from "@emailautomation/shared";

interface ThreadPillProps {
  item: AISummaryItem;
  className?: string;
}

export function ThreadPill({ item, className }: ThreadPillProps) {
  const senderName = item.senderName || item.senderEmail || "Unknown";
  const senderInitial = senderName[0]?.toUpperCase() || "?";

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={`/thread/${item.threadId}`}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5",
              "transition-colors hover:bg-muted/80",
              "max-w-[280px]",
              className
            )}
          >
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                {senderInitial}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{item.subject}</span>
            {item.tags.length > 0 && (
              <div className="flex gap-1">
                {item.tags.slice(0, 2).map((tag) => (
                  <Badge
                    key={tag.name}
                    variant="secondary"
                    className="h-4 px-1 text-[10px]"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </Badge>
                ))}
                {item.tags.length > 2 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{item.tags.length - 2}
                  </span>
                )}
              </div>
            )}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{item.subject}</p>
            <p className="text-xs text-muted-foreground">
              From: {senderName}
              {item.senderName && item.senderEmail && (
                <> ({item.senderEmail})</>
              )}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
