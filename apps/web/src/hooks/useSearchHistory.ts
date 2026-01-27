"use client";

import * as React from "react";

/**
 * Search filters structure
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
 * Search history entry
 */
export interface SearchHistoryEntry {
  id: string;
  query: string;
  filters?: SearchFilters;
  createdAt: Date;
}

/**
 * Search history operation result
 */
export interface SearchHistoryResult {
  success: boolean;
  error?: string;
}

/**
 * Search history hook return type
 */
export interface UseSearchHistoryReturn {
  /** Recent search history entries */
  searches: SearchHistoryEntry[];
  /** Add a new search to history */
  addSearch: (query: string, filters?: SearchFilters) => Promise<SearchHistoryResult>;
  /** Clear all search history */
  clearHistory: () => Promise<SearchHistoryResult>;
  /** Remove a specific search from history */
  removeSearch: (searchId: string) => Promise<SearchHistoryResult>;
  /** Whether any operation is in progress */
  isLoading: boolean;
  /** Whether the initial fetch is complete */
  isInitialized: boolean;
}

/**
 * Configuration for the useSearchHistory hook
 */
export interface UseSearchHistoryConfig {
  /** Enable localStorage caching (default: true) */
  enableLocalStorage?: boolean;
  /** localStorage key prefix (default: "email-search-history") */
  storageKey?: string;
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
}

const DEFAULT_STORAGE_KEY = "email-search-history";
const MAX_LOCAL_SEARCHES = 10;

/**
 * Custom hook for managing search history with localStorage caching and backend sync.
 *
 * Features:
 * - Fetches recent searches from backend API
 * - Saves searches to backend with automatic deduplication
 * - localStorage caching for instant access and offline support
 * - Optimistic updates for better UX
 * - Error handling with automatic fallback
 *
 * @example
 * ```tsx
 * const { searches, addSearch, clearHistory, isLoading } = useSearchHistory();
 *
 * // Add a search to history
 * await addSearch("meeting notes", { sender: "john@example.com" });
 *
 * // Display recent searches
 * {searches.map(search => (
 *   <div key={search.id}>{search.query}</div>
 * ))}
 *
 * // Clear all history
 * await clearHistory();
 * ```
 */
export function useSearchHistory(config: UseSearchHistoryConfig = {}): UseSearchHistoryReturn {
  const {
    enableLocalStorage = true,
    storageKey = DEFAULT_STORAGE_KEY,
    autoFetch = true,
  } = config;

  const [searches, setSearches] = React.useState<SearchHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isInitialized, setIsInitialized] = React.useState(false);

  /**
   * Load searches from localStorage
   */
  const loadFromLocalStorage = React.useCallback((): SearchHistoryEntry[] => {
    if (!enableLocalStorage || typeof window === "undefined") {
      return [];
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return [];

      const parsed = JSON.parse(stored) as SearchHistoryEntry[];
      // Convert date strings back to Date objects
      return parsed.map((entry) => ({
        ...entry,
        createdAt: new Date(entry.createdAt),
      }));
    } catch (error) {
      return [];
    }
  }, [enableLocalStorage, storageKey]);

  /**
   * Save searches to localStorage
   */
  const saveToLocalStorage = React.useCallback(
    (searchList: SearchHistoryEntry[]) => {
      if (!enableLocalStorage || typeof window === "undefined") {
        return;
      }

      try {
        localStorage.setItem(storageKey, JSON.stringify(searchList));
      } catch (error) {
        // Silently fail if localStorage is full or unavailable
      }
    },
    [enableLocalStorage, storageKey]
  );

  /**
   * Fetch recent searches from the backend
   */
  const fetchSearches = React.useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/emails/search/recent");

      if (!response.ok) {
        // If fetch fails, use localStorage as fallback
        const localSearches = loadFromLocalStorage();
        setSearches(localSearches);
        setIsInitialized(true);
        return;
      }

      const data = await response.json();
      const fetchedSearches: SearchHistoryEntry[] = data.searches.map(
        (search: {
          id: string;
          query: string;
          filters?: SearchFilters;
          createdAt: string | Date;
        }) => ({
          id: search.id,
          query: search.query,
          filters: search.filters,
          createdAt: new Date(search.createdAt),
        })
      );

      setSearches(fetchedSearches);
      saveToLocalStorage(fetchedSearches);
      setIsInitialized(true);
    } catch (error) {
      // On error, fall back to localStorage
      const localSearches = loadFromLocalStorage();
      setSearches(localSearches);
      setIsInitialized(true);
    } finally {
      setIsLoading(false);
    }
  }, [loadFromLocalStorage, saveToLocalStorage]);

  /**
   * Initialize - load from localStorage first, then fetch from backend
   */
  React.useEffect(() => {
    if (!autoFetch) return;

    // Load from localStorage immediately for instant display
    const localSearches = loadFromLocalStorage();
    if (localSearches.length > 0) {
      setSearches(localSearches);
    }

    // Then fetch from backend to get latest
    void fetchSearches();
  }, [autoFetch, fetchSearches, loadFromLocalStorage]);

  /**
   * Add a new search to history
   */
  const addSearch = React.useCallback(
    async (query: string, filters?: SearchFilters): Promise<SearchHistoryResult> => {
      // Don't add empty queries
      if (!query.trim()) {
        return { success: false, error: "Query cannot be empty" };
      }

      setIsLoading(true);

      try {
        // Optimistic update - add to local state immediately
        const optimisticSearch: SearchHistoryEntry = {
          id: `temp-${Date.now()}`,
          query: query.trim(),
          filters,
          createdAt: new Date(),
        };

        // Remove any duplicate queries and add new one to the front
        const updatedSearches = [
          optimisticSearch,
          ...searches.filter((s) => s.query !== query.trim()),
        ].slice(0, MAX_LOCAL_SEARCHES);

        setSearches(updatedSearches);
        saveToLocalStorage(updatedSearches);

        // Save to backend
        const response = await fetch("/api/emails/search/recent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: query.trim(), filters }),
        });

        if (!response.ok) {
          throw new Error("Failed to save search");
        }

        const data = await response.json();
        const savedSearch: SearchHistoryEntry = {
          id: data.search.id,
          query: data.search.query,
          filters: data.search.filters,
          createdAt: new Date(data.search.createdAt),
        };

        // Update with real ID from backend
        const finalSearches = [
          savedSearch,
          ...searches.filter((s) => s.query !== query.trim()),
        ].slice(0, MAX_LOCAL_SEARCHES);

        setSearches(finalSearches);
        saveToLocalStorage(finalSearches);

        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [searches, saveToLocalStorage]
  );

  /**
   * Clear all search history
   */
  const clearHistory = React.useCallback(async (): Promise<SearchHistoryResult> => {
    setIsLoading(true);

    try {
      // Optimistic update - clear immediately
      setSearches([]);
      saveToLocalStorage([]);

      // Clear on backend
      const response = await fetch("/api/emails/search/recent", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to clear search history");
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, [saveToLocalStorage]);

  /**
   * Remove a specific search from history
   */
  const removeSearch = React.useCallback(
    async (searchId: string): Promise<SearchHistoryResult> => {
      setIsLoading(true);

      try {
        // Optimistic update - remove from local state immediately
        const updatedSearches = searches.filter((s) => s.id !== searchId);
        setSearches(updatedSearches);
        saveToLocalStorage(updatedSearches);

        // Note: The backend API doesn't have a specific endpoint to delete individual searches
        // In a production app, you might want to add DELETE /api/emails/search/recent/:id
        // For now, we'll just update the local state and localStorage

        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [searches, saveToLocalStorage]
  );

  return {
    searches,
    addSearch,
    clearHistory,
    removeSearch,
    isLoading,
    isInitialized,
  };
}
