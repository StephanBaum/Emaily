"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RotateCcw, Eye, Clock, Plus } from "lucide-react";
import { getInitials } from "@/lib/format";

interface Version {
  id: string;
  bodySnapshot: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface LocalVersion {
  id: string;
  bodySnapshot: string;
  createdAt: string;
}

interface DraftVersionHistoryProps {
  draftId?: string;
  localVersions?: LocalVersion[];
  currentBody: string;
  onRestore: (body: string) => void;
  onCreateVersion?: () => void;
  refreshKey?: number;
}

export function DraftVersionHistory({
  draftId,
  localVersions,
  currentBody,
  onRestore,
  onCreateVersion,
  refreshKey,
}: DraftVersionHistoryProps) {
  const isLocalMode = !draftId;
  const [serverVersions, setServerVersions] = useState<Version[]>([]);
  const [isLoading, setIsLoading] = useState(!isLocalMode);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const fetchVersions = useCallback(async () => {
    if (!draftId) return;
    try {
      const res = await fetch(`/api/shared-drafts/${draftId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setServerVersions(data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [draftId]);

  useEffect(() => {
    if (draftId) {
      setIsLoading(true);
      fetchVersions();
    }
  }, [fetchVersions, refreshKey]);

  async function handleRestore(bodySnapshot: string, versionId?: string) {
    setIsRestoring(true);
    try {
      // For shared mode, notify the server about the restore
      if (draftId && versionId) {
        const res = await fetch(`/api/shared-drafts/${draftId}/versions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ versionId }),
        });
        if (res.ok) {
          onRestore(bodySnapshot);
        }
      } else {
        // Local mode — just restore directly
        onRestore(bodySnapshot);
      }
    } finally {
      setIsRestoring(false);
    }
  }

  // Unify version lists for rendering
  const versions: { id: string; bodySnapshot: string; createdAt: string; userName?: string }[] =
    isLocalMode
      ? (localVersions ?? []).map((v) => ({ ...v, userName: undefined }))
      : serverVersions.map((v) => ({ ...v, userName: v.user.name }));

  const previewVersion = previewId ? versions.find((v) => v.id === previewId) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground space-y-3">
        <p>No version history yet. Versions are created automatically when you pause editing.</p>
        {onCreateVersion && currentBody.trim() && (
          <Button variant="outline" size="sm" onClick={onCreateVersion}>
            <Plus className="mr-2 h-3 w-3" />
            Save Version Now
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-[400px]">
      {/* Version list */}
      <div className="w-64 border-r">
        <ScrollArea className="h-full">
          <div className="p-2 space-y-1">
            {/* Current version entry */}
            <div
              className={`flex items-start gap-2 rounded-md p-2 cursor-pointer transition-colors ${
                previewId === null ? "bg-primary/10" : "hover:bg-muted"
              }`}
              onClick={() => setPreviewId(null)}
            >
              <div className="h-6 w-6 mt-0.5 rounded-full bg-primary/20 flex items-center justify-center">
                <Eye className="h-3 w-3 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Current</p>
                <p className="text-xs text-muted-foreground">Live draft</p>
              </div>
            </div>

            {/* Historical versions */}
            {versions.map((version) => {
              const createdDate = new Date(version.createdAt);
              return (
                <div
                  key={version.id}
                  className={`group flex items-start gap-2 rounded-md p-2 cursor-pointer transition-colors ${
                    previewId === version.id ? "bg-primary/10" : "hover:bg-muted"
                  }`}
                  onClick={() =>
                    setPreviewId(previewId === version.id ? null : version.id)
                  }
                >
                  {version.userName ? (
                    <Avatar className="h-6 w-6 mt-0.5">
                      <AvatarFallback className="text-[10px]">
                        {getInitials(version.userName)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="h-6 w-6 mt-0.5 rounded-full bg-muted flex items-center justify-center">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {version.userName ?? "Auto-save"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(createdDate, { addSuffix: true })}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60">
                      {createdDate.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRestore(version.bodySnapshot, !isLocalMode ? version.id : undefined);
                    }}
                    disabled={isRestoring}
                    title="Restore this version"
                  >
                    {isRestoring ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Preview pane */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
          <span className="text-sm text-muted-foreground">
            {previewVersion ? "Version Preview" : "Current Version"}
          </span>
          <div className="flex items-center gap-2">
          {!previewVersion && onCreateVersion && currentBody.trim() && (
            <Button variant="outline" size="sm" onClick={onCreateVersion}>
              <Plus className="mr-2 h-3 w-3" />
              Save Version
            </Button>
          )}
          {previewVersion && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                handleRestore(
                  previewVersion.bodySnapshot,
                  !isLocalMode ? previewVersion.id : undefined
                )
              }
              disabled={isRestoring}
            >
              {isRestoring ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-3 w-3" />
              )}
              Restore
            </Button>
          )}
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4">
            <pre className="whitespace-pre-wrap text-sm font-sans">
              {previewVersion ? previewVersion.bodySnapshot : currentBody || "(empty)"}
            </pre>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
