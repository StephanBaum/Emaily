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
import { useTags } from "@/hooks/use-tags";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { ChevronDown, X, Mail } from "lucide-react";

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
  ].reduce((a, b) => a + b, 0);

  const selectedMailbox = mailboxes?.find((m) => m.id === mailboxId);

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
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
            >
              Tags
              {selectedTagIds.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1">
                  {selectedTagIds.length}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
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
        <div className="flex items-center gap-1">
          {tagId && (
            <Badge variant="secondary" className="text-xs">
              {tags.find((t) => t.id === tagId)?.name || "Tag"}
            </Badge>
          )}
          {group && (
            <Badge variant="secondary" className="text-xs">
              {group}
            </Badge>
          )}
        </div>
      )}

      {/* Clear Filters */}
      {activeFilterCount > 0 && !isTagView && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-muted-foreground"
          onClick={clearFilters}
        >
          <X className="h-3 w-3" />
          Clear
        </Button>
      )}
    </div>
  );
}
