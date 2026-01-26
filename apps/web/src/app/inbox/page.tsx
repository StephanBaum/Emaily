"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { EmailList, type Email } from "@/components/email";
import { ContentContainer } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Category filter configuration
 */
interface CategoryFilter {
  id: string;
  label: string;
  color: string;
}

const CATEGORY_FILTERS: CategoryFilter[] = [
  { id: "all", label: "All", color: "bg-gray-500" },
  { id: "important", label: "Important", color: "bg-red-500" },
  { id: "updates", label: "Updates", color: "bg-blue-500" },
  { id: "social", label: "Social", color: "bg-green-500" },
  { id: "promotional", label: "Promotional", color: "bg-yellow-500" },
];

/**
 * Fetches emails from the API with optional filters
 */
async function fetchEmails(params: {
  category?: string;
  filter?: string;
}): Promise<Email[]> {
  const searchParams = new URLSearchParams();

  if (params.category && params.category !== "all") {
    searchParams.set("category", params.category);
  }

  if (params.filter) {
    // Handle special filters: starred, sent, drafts, archived, spam, trash
    switch (params.filter) {
      case "starred":
        searchParams.set("isStarred", "true");
        break;
      case "archived":
        searchParams.set("category", "archived");
        break;
      case "spam":
        searchParams.set("category", "spam");
        break;
      case "trash":
        searchParams.set("isDeleted", "true");
        break;
      default:
        // For sent, drafts - would need additional handling
        break;
    }
  }

  const url = `/api/emails${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch emails: ${response.statusText}`);
  }

  return response.json();
}

/**
 * CategoryFilterBar component for filtering emails by AI-assigned category
 */
function CategoryFilterBar({
  activeCategory,
  onCategoryChange,
  emailCounts,
}: {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  emailCounts: Record<string, number>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="text-sm font-medium text-muted-foreground mr-2">
        Filter by:
      </span>
      {CATEGORY_FILTERS.map((category) => (
        <Button
          key={category.id}
          variant={activeCategory === category.id ? "default" : "outline"}
          size="sm"
          onClick={() => onCategoryChange(category.id)}
          className="gap-2"
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              activeCategory === category.id ? "bg-white" : category.color
            )}
          />
          {category.label}
          {emailCounts[category.id] !== undefined && emailCounts[category.id] > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
              {emailCounts[category.id]}
            </Badge>
          )}
        </Button>
      ))}
    </div>
  );
}

/**
 * InboxHeader displays the page title and sync status
 */
function InboxHeader({
  totalEmails,
  unreadCount,
  isLoading,
  onRefresh,
}: {
  totalEmails: number;
  unreadCount: number;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inbox</h1>
        <p className="text-sm text-muted-foreground">
          {totalEmails} emails{unreadCount > 0 && `, ${unreadCount} unread`}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isLoading}
        className="gap-2"
      >
        <svg
          className={cn(
            "h-4 w-4",
            isLoading && "animate-spin"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {isLoading ? "Syncing..." : "Refresh"}
      </Button>
    </div>
  );
}

/**
 * InboxPage is the main email inbox view.
 *
 * Features:
 * - Email list with category badges
 * - Category filter bar for quick filtering
 * - Real-time email counts by category
 * - Session protection (redirects to login if not authenticated)
 * - Loading and error states
 * - Pull-to-refresh functionality
 */
export default function InboxPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [emails, setEmails] = React.useState<Email[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = React.useState<string | null>(null);

  // Get current filter from URL params
  const urlFilter = searchParams.get("filter") || "";
  const urlCategory = searchParams.get("category") || "all";
  const [activeCategory, setActiveCategory] = React.useState(urlCategory);

  // Calculate email counts by category
  const emailCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      all: emails.length,
      important: 0,
      updates: 0,
      social: 0,
      promotional: 0,
    };

    emails.forEach((email) => {
      const category = email.category?.toLowerCase();
      if (category && counts[category] !== undefined) {
        counts[category]++;
      }
    });

    return counts;
  }, [emails]);

  // Count unread emails
  const unreadCount = React.useMemo(
    () => emails.filter((e) => !e.isRead).length,
    [emails]
  );

  // Filtered emails based on active category
  const filteredEmails = React.useMemo(() => {
    if (activeCategory === "all") {
      return emails;
    }
    return emails.filter(
      (email) => email.category?.toLowerCase() === activeCategory
    );
  }, [emails, activeCategory]);

  // Fetch emails
  const loadEmails = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const fetchedEmails = await fetchEmails({
        filter: urlFilter,
      });
      setEmails(fetchedEmails);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load emails");
    } finally {
      setIsLoading(false);
    }
  }, [urlFilter]);

  // Load emails on mount and when filter changes
  React.useEffect(() => {
    if (status === "authenticated") {
      loadEmails();
    }
  }, [status, loadEmails]);

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // Handle category filter change
  const handleCategoryChange = React.useCallback((category: string) => {
    setActiveCategory(category);
    setSelectedEmailId(null); // Clear selection when changing category
  }, []);

  // Handle email selection
  const handleEmailSelect = React.useCallback(
    (email: Email) => {
      setSelectedEmailId(email.id);
      // Navigate to email detail view
      router.push(`/inbox/${email.id}`);
    },
    [router]
  );

  // Handle refresh
  const handleRefresh = React.useCallback(() => {
    loadEmails();
  }, [loadEmails]);

  // Show loading state while checking auth
  if (status === "loading") {
    return (
      <ContentContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </ContentContainer>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (status === "unauthenticated") {
    return null;
  }

  return (
    <ContentContainer className="h-full">
      <InboxHeader
        totalEmails={filteredEmails.length}
        unreadCount={unreadCount}
        isLoading={isLoading}
        onRefresh={handleRefresh}
      />

      <CategoryFilterBar
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        emailCounts={emailCounts}
      />

      {error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-4 mb-4">
            <svg
              className="h-8 w-8 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">
            Failed to load emails
          </h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline">
            Try again
          </Button>
        </div>
      ) : (
        <EmailList
          emails={filteredEmails}
          selectedEmailId={selectedEmailId}
          onEmailSelect={handleEmailSelect}
          isLoading={isLoading}
          emptyMessage={
            activeCategory === "all"
              ? "Your inbox is empty. New emails will appear here."
              : `No ${activeCategory} emails found.`
          }
        />
      )}
    </ContentContainer>
  );
}
