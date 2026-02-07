"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSearch } from "@/hooks/use-search";
import { Search, Loader2, Archive, Clock } from "lucide-react";

interface SearchBarProps {
  status?: string;
  tagId?: string;
  mailboxId?: string;
}

export function SearchBar({ status, tagId, mailboxId }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { results, total, highlights, isLoading, isDebouncing } = useSearch({
    query,
    status,
    tagId,
    mailboxId,
    limit: 8,
  });

  const hasResults = results && results.length > 0;
  const showDropdown = isOpen && query.length >= 2;

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navigateToThread = useCallback(
    (threadId: string) => {
      setIsOpen(false);
      setQuery("");
      router.push(`/thread/${threadId}`);
    },
    [router]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown || !hasResults) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, (results?.length ?? 1) - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (results?.[selectedIndex]) {
          navigateToThread(results[selectedIndex].id);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search emails..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="h-8 w-56 pl-8 text-sm focus-visible:w-72 transition-all"
        />
        {(isLoading || isDebouncing) && query.length >= 2 && (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full z-50 mt-1 w-96 rounded-md border bg-popover shadow-lg"
        >
          {query.length < 2 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Type at least 2 characters
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center gap-2 p-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Searching...</span>
            </div>
          ) : !hasResults ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No emails matching &ldquo;{query}&rdquo;
            </div>
          ) : (
            <>
              <div className="px-3 py-2 text-xs text-muted-foreground border-b">
                {total === 1
                  ? "1 result"
                  : `Showing ${results.length} of ${total} results`}
              </div>
              <div className="max-h-80 overflow-y-auto py-1">
                {results.map((thread, index) => {
                  const latestEmail = thread.emails[0];
                  const senderName =
                    latestEmail?.fromName || latestEmail?.fromAddress || "Unknown";
                  const highlight = highlights[thread.id];

                  return (
                    <button
                      key={thread.id}
                      onClick={() => navigateToThread(thread.id)}
                      className={cn(
                        "w-full px-3 py-2 text-left transition-colors",
                        index === selectedIndex
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/50"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {thread.subject}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {thread.status === "archived" && (
                            <Archive className="h-3 w-3 text-muted-foreground" />
                          )}
                          {thread.status === "snoozed" && (
                            <Clock className="h-3 w-3 text-amber-500" />
                          )}
                        </div>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {senderName}
                      </div>
                      {highlight && (
                        <p
                          className="mt-1 line-clamp-2 text-xs text-muted-foreground"
                          dangerouslySetInnerHTML={{ __html: highlight }}
                        />
                      )}
                      {thread.tags.length > 0 && (
                        <div className="mt-1.5 flex gap-1">
                          {thread.tags.map(({ tag }) => (
                            <Badge
                              key={tag.id}
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0"
                              style={{
                                backgroundColor: `${tag.color}20`,
                                color: tag.color,
                                borderColor: tag.color,
                              }}
                            >
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
