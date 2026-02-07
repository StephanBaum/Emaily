"use client";

import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Eye } from "lucide-react";

interface SeenByUser {
  id: string;
  seenAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface SeenByIndicatorProps {
  seenBy: SeenByUser[];
  maxVisible?: number;
  compact?: boolean;
}

export function SeenByIndicator({ seenBy, maxVisible = 4, compact = false }: SeenByIndicatorProps) {
  if (seenBy.length === 0) return null;

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  // Compact mode for panel - vertical list
  if (compact) {
    return (
      <TooltipProvider>
        <div className="space-y-1">
          {seenBy.map((seen) => (
            <div
              key={seen.id}
              className="flex items-center gap-2 rounded-md bg-background p-1.5"
            >
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[9px] bg-secondary">
                  {getInitials(seen.user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{seen.user.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(seen.seenAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </TooltipProvider>
    );
  }

  const visibleUsers = seenBy.slice(0, maxVisible);
  const remainingCount = seenBy.length - maxVisible;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 text-muted-foreground" />
        <div className="flex -space-x-2">
          {visibleUsers.map((seen) => (
            <Tooltip key={seen.id}>
              <TooltipTrigger asChild>
                <Avatar className="h-6 w-6 border-2 border-background cursor-default">
                  <AvatarFallback className="text-[10px] bg-secondary">
                    {getInitials(seen.user.name)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p className="font-medium">{seen.user.name}</p>
                <p className="text-muted-foreground">
                  Viewed {formatDistanceToNow(new Date(seen.seenAt), { addSuffix: true })}
                </p>
              </TooltipContent>
            </Tooltip>
          ))}
          {remainingCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-6 w-6 border-2 border-background cursor-default">
                  <AvatarFallback className="text-[10px] bg-muted">
                    +{remainingCount}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p className="font-medium">{remainingCount} more</p>
                {seenBy.slice(maxVisible).map((seen) => (
                  <p key={seen.id} className="text-muted-foreground">
                    {seen.user.name}
                  </p>
                ))}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {seenBy.length} viewed
        </span>
      </div>
    </TooltipProvider>
  );
}
