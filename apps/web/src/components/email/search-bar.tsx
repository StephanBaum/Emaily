"use client";

import * as React from "react";
import { Search, Clock, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Search history entry from the API
 */
export interface SearchHistoryEntry {
  id: string;
  query: string;
  filters?: {
    sender?: string;
    dateFrom?: string;
    dateTo?: string;
    hasAttachments?: boolean;
    category?: string;
    isRead?: boolean;
  };
  createdAt: Date;
}

/**
 * Props for the SearchBar component
 */
export interface SearchBarProps {
  /** Current search query value */
  value?: string;
  /** Callback when search query changes (debounced) */
  onSearch?: (query: string) => void;
  /** Callback when user selects a recent search */
  onSelectRecent?: (entry: SearchHistoryEntry) => void;
  /** Recent search history entries */
  recentSearches?: SearchHistoryEntry[];
  /** Whether the component is in loading state */
  isLoading?: boolean;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
}

/**
 * Loading skeleton for recent searches dropdown
 */
function RecentSearchesSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-2 px-3 py-2 animate-pulse"
        >
          <div className="h-4 w-4 rounded bg-muted" />
          <div className="h-4 flex-1 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * Recent searches dropdown content
 */
function RecentSearchesDropdown({
  searches,
  onSelect,
  isLoading,
}: {
  searches: SearchHistoryEntry[];
  onSelect: (entry: SearchHistoryEntry) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <RecentSearchesSkeleton />;
  }

  if (searches.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        No recent searches
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="px-3 pb-2 text-xs font-medium text-muted-foreground">
        Recent Searches
      </div>
      {searches.map((entry) => (
        <button
          key={entry.id}
          onClick={() => onSelect(entry)}
          className={cn(
            "flex w-full items-center gap-3 px-3 py-2 text-sm",
            "hover:bg-accent hover:text-accent-foreground",
            "transition-colors cursor-pointer text-left"
          )}
        >
          <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="flex-1 truncate">{entry.query}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * SearchBar component for email search with autocomplete and recent searches.
 *
 * Features:
 * - Debounced search input (default 300ms)
 * - Recent searches dropdown on focus
 * - Clear button when input has value
 * - Loading state support
 * - Keyboard navigation (Escape to close dropdown)
 * - Accessible with proper ARIA labels
 *
 * @example
 * ```tsx
 * <SearchBar
 *   value={searchQuery}
 *   onSearch={handleSearch}
 *   recentSearches={recentSearches}
 *   onSelectRecent={handleSelectRecent}
 *   placeholder="Search emails..."
 * />
 * ```
 */
export function SearchBar({
  value = "",
  onSearch,
  onSelectRecent,
  recentSearches = [],
  isLoading = false,
  placeholder = "Search emails...",
  className,
  debounceMs = 300,
}: SearchBarProps) {
  const [inputValue, setInputValue] = React.useState(value);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Update internal state when external value changes
  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Debounced search callback
  const debouncedSearch = React.useCallback(
    (query: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        onSearch?.(query);
      }, debounceMs);
    },
    [onSearch, debounceMs]
  );

  // Handle input change
  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      debouncedSearch(newValue);
    },
    [debouncedSearch]
  );

  // Handle clear button click
  const handleClear = React.useCallback(() => {
    setInputValue("");
    onSearch?.("");
    inputRef.current?.focus();
  }, [onSearch]);

  // Handle recent search selection
  const handleSelectRecent = React.useCallback(
    (entry: SearchHistoryEntry) => {
      setInputValue(entry.query);
      setShowDropdown(false);
      onSelectRecent?.(entry);
      onSearch?.(entry.query);
    },
    [onSearch, onSelectRecent]
  );

  // Handle input focus
  const handleFocus = React.useCallback(() => {
    setIsFocused(true);
    setShowDropdown(true);
  }, []);

  // Handle input blur
  const handleBlur = React.useCallback(() => {
    setIsFocused(false);
    // Delay hiding dropdown to allow clicking on items
    setTimeout(() => {
      setShowDropdown(false);
    }, 200);
  }, []);

  // Handle keyboard events
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setShowDropdown(false);
        inputRef.current?.blur();
      }
    },
    []
  );

  // Cleanup debounce timer on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Show dropdown when focused and has recent searches
  const shouldShowDropdown =
    showDropdown && isFocused && recentSearches.length > 0;

  return (
    <div className={cn("relative w-full", className)}>
      <div className="relative">
        {/* Search icon */}
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

        {/* Search input */}
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn("pl-9", inputValue && "pr-9")}
          aria-label="Search emails"
          aria-expanded={shouldShowDropdown}
          aria-controls="search-dropdown"
        />

        {/* Clear button */}
        {inputValue && (
          <button
            onClick={handleClear}
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2",
              "text-muted-foreground hover:text-foreground",
              "transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm"
            )}
            aria-label="Clear search"
            tabIndex={0}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Recent searches dropdown */}
      {shouldShowDropdown && (
        <div
          ref={dropdownRef}
          id="search-dropdown"
          className={cn(
            "absolute top-full left-0 right-0 mt-2 z-50",
            "rounded-md border bg-popover text-popover-foreground shadow-md",
            "animate-in fade-in-0 zoom-in-95"
          )}
          role="listbox"
          aria-label="Recent searches"
        >
          <RecentSearchesDropdown
            searches={recentSearches}
            onSelect={handleSelectRecent}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
}
