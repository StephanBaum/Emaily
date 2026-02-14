"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTags } from "@/hooks/use-tags";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { ChevronDown, X, Mail, Tag } from "lucide-react";

interface FilterToolbarProps {
  status?: string;
  tagId?: string;
  tagIds?: string;
  mailboxId?: string;
  group?: string;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "archived", label: "Archived" },
  { value: "snoozed", label: "Snoozed" },
] as const;

export function FilterToolbar({
  status,
  tagId,
  tagIds,
  mailboxId,
  group,
}: FilterToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tags } = useTags();
  const { mailboxes } = useMailboxes();

  // Simplified mode: only when navigating via sidebar (single tag click or group click)
  // Toolbar multi-select sets `tags` without `group`, so that stays in full mode
  const isTagView = Boolean(tagId || (tagIds && group));

  // Determine active status for the tabs
  const activeStatus = status || (isTagView ? "all" : "open");

  // Currently selected tag IDs (from multi-select, not sidebar)
  const selectedTagIds = tagIds ? tagIds.split(",").filter(Boolean) : [];

  function updateFilters(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    const query = params.toString();
    router.push(`/inbox${query ? `?${query}` : ""}`);
  }

  function handleStatusChange(newStatus: string) {
    if (newStatus === "open" && !isTagView) {
      // "open" is the default for inbox — remove the param
      updateFilters({ status: undefined });
    } else {
      updateFilters({ status: newStatus });
    }
  }

  function handleTagToggle(id: string) {
    const current = new Set(selectedTagIds);
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }

    const ids = Array.from(current).join(",");
    updateFilters({
      tags: ids || undefined,
      tag: undefined, // clear single-tag param when using multi-select
      group: undefined,
    });
  }

  function handleMailboxChange(id: string | undefined) {
    updateFilters({ mailbox: id });
  }

  function clearFilters() {
    router.push("/inbox");
  }

  // Count active non-default filters
  const activeFilterCount = [
    activeStatus !== "open" && activeStatus !== "all" ? 1 : 0,
    selectedTagIds.length > 0 ? 1 : 0,
    mailboxId ? 1 : 0,
  ].reduce((sum, count) => sum + count, 0);

  const selectedMailbox = mailboxes?.find((mailbox) => mailbox.id === mailboxId);

  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {/* Status Tabs */}
      <div className="flex items-center rounded-lg border bg-muted/30 p-0.5">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleStatusChange(opt.value)}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              activeStatus === opt.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Tag Multi-Select (full mode only) */}
      {!isTagView && tags && tags.length > 0 && (
        <div className="flex items-center gap-1.5">
          {/* Selected tag badges */}
          {selectedTagIds.map((id) => {
            const tag = tags.find((candidate) => candidate.id === id);
            if (!tag) return null;
            return (
              <Badge
                key={tag.id}
                variant="secondary"
                className="group cursor-default text-xs pr-1.5 gap-1"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color,
                }}
              >
                {tag.name}
                <button
                  onClick={() => handleTagToggle(tag.id)}
                  className="shrink-0 opacity-60 hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}

          {/* Add tag / clear button group */}
          <div className="flex items-center rounded-md border border-transparent hover:[&>*]:first:rounded-l-md hover:[&>*]:last:rounded-r-md">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "inline-flex items-center gap-1 h-7 px-2 text-xs text-muted-foreground rounded-md hover:bg-accent transition-colors",
                    activeFilterCount > 0 && "rounded-r-none"
                  )}
                >
                  <Tag className="h-3.5 w-3.5" />
                  {selectedTagIds.length === 0 ? "Filter by tag" : "+"}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-2">
                <div className="space-y-1">
                  {tags.map((tag) => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleTagToggle(tag.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                          isSelected
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/50"
                        )}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="flex-1 text-left truncate">
                          {tag.name}
                        </span>
                        {isSelected && (
                          <span className="text-xs font-medium">&#10003;</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            {activeFilterCount > 0 && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={clearFilters}
                      className="inline-flex items-center justify-center h-7 px-1.5 rounded-l-none rounded-r-md text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    <TooltipArrow />
                    Clear all filters
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      )}

      {/* Mailbox Dropdown (full mode only) */}
      {!isTagView && mailboxes && mailboxes.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1">
              <Mail className="h-3 w-3" />
              {selectedMailbox
                ? selectedMailbox.displayName || selectedMailbox.emailAddress
                : "All Mailboxes"}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => handleMailboxChange(undefined)}>
              All Mailboxes
            </DropdownMenuItem>
            {mailboxes.map((mailbox) => (
              <DropdownMenuItem
                key={mailbox.id}
                onClick={() => handleMailboxChange(mailbox.id)}
              >
                {mailbox.displayName || mailbox.emailAddress}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Active tag badges (in tag view or multi-select) */}
      {isTagView && tags && (
        <div className="flex items-center gap-1.5">
          {tagId && (() => {
            const tag = tags.find((candidate) => candidate.id === tagId);
            return tag ? (
              <Badge
                variant="secondary"
                className="text-xs"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color,
                }}
              >
                {tag.name}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Tag</Badge>
            );
          })()}
          {group && (
            <Badge variant="secondary" className="text-xs">
              {group}
            </Badge>
          )}
        </div>
      )}

    </div>
  );
}
