"use client";

import * as React from "react";
import { Calendar, Paperclip, Mail, MailOpen, ChevronDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Search filter values
 */
export interface SearchFilters {
  sender?: string;
  dateFrom?: string;
  dateTo?: string;
  hasAttachments?: boolean;
  category?: string;
  isRead?: boolean;
}

/**
 * Props for the SearchFilters component
 */
export interface SearchFiltersProps {
  /** Current filter values */
  filters?: SearchFilters;
  /** Callback when filters change */
  onFiltersChange?: (filters: SearchFilters) => void;
  /** Whether the component is expanded */
  isExpanded?: boolean;
  /** Callback when expand state changes */
  onExpandChange?: (expanded: boolean) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Category filter configuration
 */
interface CategoryOption {
  id: string;
  label: string;
  color: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { id: "", label: "All Categories", color: "bg-gray-500" },
  { id: "important", label: "Important", color: "bg-red-500" },
  { id: "updates", label: "Updates", color: "bg-blue-500" },
  { id: "social", label: "Social", color: "bg-green-500" },
  { id: "promotional", label: "Promotional", color: "bg-yellow-500" },
];

/**
 * Category dropdown component
 */
function CategoryDropdown({
  value,
  onChange,
}: {
  value?: string;
  onChange: (category: string) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const selectedCategory = CATEGORY_OPTIONS.find((cat) => cat.id === (value || ""));
  const displayLabel = selectedCategory?.label || "All Categories";

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }

    return undefined;
  }, [isOpen]);

  const handleSelect = (categoryId: string) => {
    onChange(categoryId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2 w-full justify-between"
      >
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              selectedCategory?.color || "bg-gray-500"
            )}
          />
          {displayLabel}
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </Button>

      {isOpen && (
        <div
          className={cn(
            "absolute top-full left-0 right-0 mt-2 z-50",
            "rounded-md border bg-popover text-popover-foreground shadow-md",
            "animate-in fade-in-0 zoom-in-95"
          )}
        >
          <div className="py-1">
            {CATEGORY_OPTIONS.map((category) => (
              <button
                key={category.id}
                onClick={() => handleSelect(category.id)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-sm",
                  "hover:bg-accent hover:text-accent-foreground",
                  "transition-colors cursor-pointer text-left",
                  (value || "") === category.id && "bg-accent"
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", category.color)} />
                {category.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * SearchFilters component for advanced email filtering.
 *
 * Features:
 * - Sender email filter
 * - Date range picker (from/to)
 * - Has attachments toggle
 * - Category filter dropdown
 * - Read/unread status filter
 * - Collapsible panel
 * - Clear all filters button
 *
 * @example
 * ```tsx
 * <SearchFilters
 *   filters={currentFilters}
 *   onFiltersChange={handleFiltersChange}
 *   isExpanded={showFilters}
 *   onExpandChange={setShowFilters}
 * />
 * ```
 */
export function SearchFilters({
  filters = {},
  onFiltersChange,
  isExpanded = false,
  onExpandChange,
  className,
}: SearchFiltersProps) {
  // Track active filter count
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (filters.sender) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.hasAttachments !== undefined) count++;
    if (filters.category) count++;
    if (filters.isRead !== undefined) count++;
    return count;
  }, [filters]);

  // Handle filter changes
  const updateFilter = React.useCallback(
    (key: keyof SearchFilters, value: any) => {
      const newFilters = { ...filters, [key]: value };
      // Remove undefined values
      Object.keys(newFilters).forEach((k) => {
        if (newFilters[k as keyof SearchFilters] === undefined) {
          delete newFilters[k as keyof SearchFilters];
        }
      });
      onFiltersChange?.(newFilters);
    },
    [filters, onFiltersChange]
  );

  // Clear all filters
  const handleClearAll = React.useCallback(() => {
    onFiltersChange?.({});
  }, [onFiltersChange]);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Toggle button */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onExpandChange?.(!isExpanded)}
          className="gap-2"
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")}
          />
          <span className="text-sm font-medium">Advanced Filters</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {activeFilterCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear all
          </Button>
        )}
      </div>

      {/* Filters panel */}
      {isExpanded && (
        <div
          className={cn(
            "rounded-lg border bg-card p-4 space-y-4",
            "animate-in slide-in-from-top-2 fade-in-0"
          )}
        >
          {/* Sender filter */}
          <div className="space-y-2">
            <label
              htmlFor="sender-filter"
              className="text-sm font-medium text-foreground"
            >
              Sender
            </label>
            <Input
              id="sender-filter"
              type="email"
              placeholder="Enter sender email..."
              value={filters.sender || ""}
              onChange={(e) => updateFilter("sender", e.target.value || undefined)}
              className="w-full"
            />
          </div>

          {/* Date range filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Date Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor="date-from" className="text-xs text-muted-foreground">
                  From
                </label>
                <Input
                  id="date-from"
                  type="date"
                  value={filters.dateFrom || ""}
                  onChange={(e) => updateFilter("dateFrom", e.target.value || undefined)}
                  className="w-full"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="date-to" className="text-xs text-muted-foreground">
                  To
                </label>
                <Input
                  id="date-to"
                  type="date"
                  value={filters.dateTo || ""}
                  onChange={(e) => updateFilter("dateTo", e.target.value || undefined)}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Has attachments toggle */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Attachments
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={filters.hasAttachments === undefined ? "default" : "outline"}
                size="sm"
                onClick={() => updateFilter("hasAttachments", undefined)}
                className="flex-1"
              >
                All
              </Button>
              <Button
                type="button"
                variant={filters.hasAttachments === true ? "default" : "outline"}
                size="sm"
                onClick={() => updateFilter("hasAttachments", true)}
                className="flex-1"
              >
                With Attachments
              </Button>
              <Button
                type="button"
                variant={filters.hasAttachments === false ? "default" : "outline"}
                size="sm"
                onClick={() => updateFilter("hasAttachments", false)}
                className="flex-1"
              >
                No Attachments
              </Button>
            </div>
          </div>

          {/* Category filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Category</label>
            <CategoryDropdown
              value={filters.category}
              onChange={(category) => updateFilter("category", category || undefined)}
            />
          </div>

          {/* Read/Unread status filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Status</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={filters.isRead === undefined ? "default" : "outline"}
                size="sm"
                onClick={() => updateFilter("isRead", undefined)}
                className="flex-1 gap-2"
              >
                All
              </Button>
              <Button
                type="button"
                variant={filters.isRead === false ? "default" : "outline"}
                size="sm"
                onClick={() => updateFilter("isRead", false)}
                className="flex-1 gap-2"
              >
                <Mail className="h-4 w-4" />
                Unread
              </Button>
              <Button
                type="button"
                variant={filters.isRead === true ? "default" : "outline"}
                size="sm"
                onClick={() => updateFilter("isRead", true)}
                className="flex-1 gap-2"
              >
                <MailOpen className="h-4 w-4" />
                Read
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
