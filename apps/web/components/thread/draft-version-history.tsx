"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RotateCcw, Eye, EyeOff } from "lucide-react";

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

interface DraftVersionHistoryProps {
  draftId: string;
  currentBody: string;
  onRestore: (body: string) => void;
  refreshKey?: number;
}

export function DraftVersionHistory({
  draftId,
  currentBody,
  onRestore,
  refreshKey,
}: DraftVersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/shared-drafts/${draftId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [draftId]);

  useEffect(() => {
    setIsLoading(true);
    fetchVersions();
  }, [fetchVersions, refreshKey]);

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  async function handleRestore(version: Version) {
    setIsRestoring(true);
    try {
      const res = await fetch(`/api/shared-drafts/${draftId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: version.id }),
      });

      if (res.ok) {
        onRestore(version.bodySnapshot);
      }
    } finally {
      setIsRestoring(false);
    }
  }

  const previewVersion = previewId
    ? versions.find((v) => v.id === previewId)
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No version history yet. Versions are created automatically when you save changes.
      </div>
    );
  }

  return (
    <div className="flex h-[400px]">
      {/* Version list */}
      <div className="w-64 border-r">
        <ScrollArea className="h-full">
          <div className="p-2 space-y-1">
            {versions.map((version) => (
              <div
                key={version.id}
                className={`group flex items-start gap-2 rounded-md p-2 cursor-pointer transition-colors ${
                  previewId === version.id
                    ? "bg-primary/10"
                    : "hover:bg-muted"
                }`}
                onClick={() =>
                  setPreviewId(previewId === version.id ? null : version.id)
                }
              >
                <Avatar className="h-6 w-6 mt-0.5">
                  <AvatarFallback className="text-[10px]">
                    {getInitials(version.user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {version.user.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(version.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRestore(version);
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
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Preview pane */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
          <span className="text-sm text-muted-foreground">
            {previewVersion ? "Version Preview" : "Current Version"}
          </span>
          {previewVersion && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleRestore(previewVersion)}
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
