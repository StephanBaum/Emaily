"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tag, Check, X } from "lucide-react";
import { useThreadActions } from "@/hooks/use-thread-actions";
import { useTags } from "@/hooks/use-tags";

interface TagData {
  id: string;
  name: string;
  color: string;
}

interface ThreadTag {
  tag: TagData;
}

interface TagPickerProps {
  threadId: string;
  currentTags: ThreadTag[];
}

export function TagPicker({ threadId, currentTags }: TagPickerProps) {
  const { addTag, removeTag: removeTagAction } = useThreadActions(threadId);
  const { tags: allTags, isLoading } = useTags();
  const [open, setOpen] = useState(false);
  const [appliedTagIds, setAppliedTagIds] = useState<Set<string>>(
    new Set(currentTags.map((t) => t.tag.id))
  );

  useEffect(() => {
    setAppliedTagIds(new Set(currentTags.map((t) => t.tag.id)));
  }, [currentTags]);

  async function toggleTag(tag: TagData) {
    const isApplied = appliedTagIds.has(tag.id);

    // Update local state immediately
    setAppliedTagIds((prev) => {
      const next = new Set(prev);
      if (isApplied) {
        next.delete(tag.id);
      } else {
        next.add(tag.id);
      }
      return next;
    });

    // Use optimistic actions - no router.refresh() needed
    if (isApplied) {
      await removeTagAction(tag.id);
    } else {
      await addTag(tag);
    }
  }

  async function removeTag(tagId: string) {
    // Update local state immediately
    setAppliedTagIds((prev) => {
      const next = new Set(prev);
      next.delete(tagId);
      return next;
    });

    // Use optimistic action
    await removeTagAction(tagId);
  }

  // Convert TagData from useTags to the simpler format used here
  const simpleTags: TagData[] = (allTags || []).map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
  }));

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {currentTags.map(({ tag }) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className="group cursor-default text-xs pr-1.5"
          style={{
            backgroundColor: `${tag.color}20`,
            color: tag.color,
          }}
        >
          {tag.name}
          <span className="inline-flex max-w-0 overflow-hidden opacity-0 transition-all duration-150 group-hover:max-w-[20px] group-hover:opacity-100 group-hover:ml-0.5">
            <button onClick={() => removeTag(tag.id)} className="shrink-0">
              <X className="h-3 w-3" />
            </button>
          </span>
        </Badge>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground">
            <Tag className="mr-1 h-3 w-3" />
            {currentTags.length === 0 ? "Add tag" : "+"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" align="start">
          <TagSelectionList
            tags={simpleTags}
            appliedTagIds={appliedTagIds}
            loading={isLoading}
            onToggle={toggleTag}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Standalone tag selection popover for the 3-dot menu */
export function TagMenuPopover({
  threadId,
  currentTags,
  open,
  onOpenChange,
}: {
  threadId: string;
  currentTags: ThreadTag[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addTag, removeTag: removeTagAction } = useThreadActions(threadId);
  const { tags: allTags, isLoading } = useTags();
  const [appliedTagIds, setAppliedTagIds] = useState<Set<string>>(
    new Set(currentTags.map((t) => t.tag.id))
  );

  useEffect(() => {
    setAppliedTagIds(new Set(currentTags.map((t) => t.tag.id)));
  }, [currentTags]);

  async function toggleTag(tag: TagData) {
    const isApplied = appliedTagIds.has(tag.id);

    // Update local state immediately
    setAppliedTagIds((prev) => {
      const next = new Set(prev);
      if (isApplied) {
        next.delete(tag.id);
      } else {
        next.add(tag.id);
      }
      return next;
    });

    // Use optimistic actions - no router.refresh() needed
    if (isApplied) {
      await removeTagAction(tag.id);
    } else {
      await addTag(tag);
    }
  }

  // Convert TagData from useTags to the simpler format used here
  const simpleTags: TagData[] = (allTags || []).map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
  }));

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <div className="absolute top-0 right-0 h-0 w-0" />
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="end">
        <TagSelectionList
          tags={simpleTags}
          appliedTagIds={appliedTagIds}
          loading={isLoading}
          onToggle={toggleTag}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Shared tag list UI used by both picker and menu */
function TagSelectionList({
  tags,
  appliedTagIds,
  loading,
  onToggle,
}: {
  tags: TagData[];
  appliedTagIds: Set<string>;
  loading: boolean;
  onToggle: (tag: TagData) => void;
}) {
  if (loading) {
    return <p className="px-2 py-1 text-sm text-muted-foreground">Loading...</p>;
  }
  if (tags.length === 0) {
    return <p className="px-2 py-1 text-sm text-muted-foreground">No tags yet</p>;
  }
  return (
    <div className="space-y-0.5">
      {tags.map((tag) => {
        const isApplied = appliedTagIds.has(tag.id);
        return (
          <button
            key={tag.id}
            onClick={() => onToggle(tag)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: tag.color }}
            />
            <span className="flex-1 text-left truncate">{tag.name}</span>
            {isApplied && (
              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  );
}
