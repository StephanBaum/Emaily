"use client";

import { Button } from "@/components/ui/button";
import { Archive, Inbox, Trash2, X } from "lucide-react";

interface BulkActionBarProps {
  selectedCount: number;
  onArchive: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onClear: () => void;
  currentStatus?: string;
}

export function BulkActionBar({
  selectedCount,
  onArchive,
  onTrash,
  onRestore,
  onDelete,
  onClear,
  currentStatus,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  const isTrashView = currentStatus === "trashed";

  return (
    <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/95 px-4 py-2 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>
      </div>

      <div className="flex items-center gap-2">
        {isTrashView ? (
          <>
            <Button variant="outline" size="sm" onClick={onRestore}>
              <Inbox className="mr-2 h-4 w-4" />
              Restore
            </Button>
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Forever
            </Button>
          </>
        ) : (
          <>
            {currentStatus !== "archived" && (
              <Button variant="outline" size="sm" onClick={onArchive}>
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </Button>
            )}
            {currentStatus === "archived" && (
              <Button variant="outline" size="sm" onClick={onRestore}>
                <Inbox className="mr-2 h-4 w-4" />
                Move to Inbox
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onTrash}>
              <Trash2 className="mr-2 h-4 w-4" />
              Trash
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
