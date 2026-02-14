"use client";

import { useImapStatus } from "@/hooks/use-imap-status";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertCircle, CheckCircle2, Loader2, WifiOff } from "lucide-react";

export function ImapStatusIndicator() {
  const { isConnected, pendingOperations, hasFailures, isLoading } =
    useImapStatus();

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Checking...</span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs text-orange-500">
              <WifiOff className="h-3 w-3" />
              <span>Offline</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>IMAP queue is not connected.</p>
            <p className="text-muted-foreground">
              Changes will sync when connection is restored.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (hasFailures) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              <span>Sync errors</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Some IMAP operations failed.</p>
            <p className="text-muted-foreground">
              Check your email server connection.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (pendingOperations > 0) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Syncing {pendingOperations}...</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{pendingOperations} operations pending.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 text-xs text-green-500">
            <CheckCircle2 className="h-3 w-3" />
            <span>Synced</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>All changes synced to IMAP server.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
