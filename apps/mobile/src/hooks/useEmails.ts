import { useCallback, useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { useAuthContext } from '../contexts/AuthContext';

/**
 * API URL from app configuration
 */
const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

/**
 * Email address with optional display name
 */
export interface EmailAddress {
  email: string;
  name: string | null;
}

/**
 * Email item as returned from the API
 */
export interface Email {
  id: string;
  messageId: string;
  threadId: string | null;
  subject: string;
  sender: string;
  senderEmail?: string;
  recipients: string[];
  body: string;
  bodyHtml?: string | null;
  snippet?: string;
  isRead: boolean;
  isStarred: boolean;
  category: string | null;
  priority: number | null;
  summary: string | null;
  receivedAt: string;
  hasAttachments?: boolean;
}

/**
 * Category filter options for email list
 */
export type EmailCategory =
  | 'all'
  | 'important'
  | 'promotional'
  | 'social'
  | 'updates'
  | 'spam'
  | 'starred'
  | 'archived';

/**
 * Options for fetching emails
 */
export interface FetchEmailsOptions {
  category?: EmailCategory;
  page?: number;
  limit?: number;
  search?: string;
  includeArchived?: boolean;
}

/**
 * Response from the emails API
 */
interface EmailsApiResponse {
  emails: Email[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * State returned by the useEmails hook
 */
export interface UseEmailsState {
  emails: Email[];
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  error: Error | null;
  hasMore: boolean;
  total: number;
}

/**
 * Actions returned by the useEmails hook
 */
export interface UseEmailsActions {
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  archiveEmail: (emailId: string) => Promise<void>;
  unarchiveEmail: (emailId: string) => Promise<void>;
  deleteEmail: (emailId: string) => Promise<void>;
  markAsRead: (emailId: string) => Promise<void>;
  markAsUnread: (emailId: string) => Promise<void>;
  starEmail: (emailId: string) => Promise<void>;
  unstarEmail: (emailId: string) => Promise<void>;
  setCategory: (category: EmailCategory) => void;
}

export type UseEmailsReturn = UseEmailsState & UseEmailsActions;

/**
 * useEmails hook for fetching and managing emails
 *
 * Provides email list with pagination, filtering, and actions.
 * Handles authentication via the auth context.
 *
 * @example
 * ```tsx
 * const {
 *   emails,
 *   isLoading,
 *   refresh,
 *   loadMore,
 *   archiveEmail,
 * } = useEmails({ category: 'all' });
 *
 * return (
 *   <FlatList
 *     data={emails}
 *     onRefresh={refresh}
 *     onEndReached={loadMore}
 *   />
 * );
 * ```
 */
export function useEmails(options: FetchEmailsOptions = {}): UseEmailsReturn {
  const { tokens, isAuthenticated } = useAuthContext();
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState<EmailCategory>(options.category || 'all');
  const [page, setPage] = useState(1);
  const limit = options.limit || 20;

  // Track if component is mounted
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Build query string for API request
   */
  const buildQueryString = useCallback(
    (pageNum: number): string => {
      const params = new URLSearchParams();
      params.set('page', pageNum.toString());
      params.set('limit', limit.toString());

      if (category !== 'all') {
        if (category === 'starred') {
          params.set('starred', 'true');
        } else if (category === 'archived') {
          params.set('archived', 'true');
        } else {
          params.set('category', category);
        }
      }

      if (options.search) {
        params.set('search', options.search);
      }

      if (options.includeArchived) {
        params.set('includeArchived', 'true');
      }

      return params.toString();
    },
    [category, limit, options.search, options.includeArchived]
  );

  /**
   * Fetch emails from the API
   */
  const fetchEmails = useCallback(
    async (pageNum: number, replace: boolean = false): Promise<void> => {
      if (!isAuthenticated || !tokens?.accessToken) {
        setError(new Error('Not authenticated'));
        setIsLoading(false);
        return;
      }

      try {
        const queryString = buildQueryString(pageNum);
        // Use search endpoint when search query is provided
        const endpoint = options.search
          ? `${API_URL}/api/emails/search?${queryString}`
          : `${API_URL}/api/emails?${queryString}`;

        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Authentication expired. Please sign in again.');
          }
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch emails: ${response.status}`);
        }

        const data: EmailsApiResponse = await response.json();

        if (!isMountedRef.current) return;

        if (replace) {
          setEmails(data.emails);
        } else {
          setEmails((prev) => [...prev, ...data.emails]);
        }

        setTotal(data.total);
        setHasMore(data.hasMore);
        setPage(pageNum);
        setError(null);
      } catch (err) {
        if (!isMountedRef.current) return;
        setError(err instanceof Error ? err : new Error('Failed to fetch emails'));
      }
    },
    [isAuthenticated, tokens?.accessToken, buildQueryString, options.search]
  );

  /**
   * Initial fetch on mount and when category/options change
   */
  useEffect(() => {
    if (isAuthenticated) {
      setIsLoading(true);
      setEmails([]);
      fetchEmails(1, true).finally(() => {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      });
    } else {
      setIsLoading(false);
      setEmails([]);
    }
  }, [isAuthenticated, category, options.search, fetchEmails]);

  /**
   * Pull-to-refresh handler
   */
  const refresh = useCallback(async (): Promise<void> => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      await fetchEmails(1, true);
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [isRefreshing, fetchEmails]);

  /**
   * Load more (pagination) handler
   */
  const loadMore = useCallback(async (): Promise<void> => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      await fetchEmails(page + 1, false);
    } finally {
      if (isMountedRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [isLoadingMore, hasMore, page, fetchEmails]);

  /**
   * Perform an action on an email
   */
  const performEmailAction = useCallback(
    async (emailId: string, action: string, method: string, endpoint?: string): Promise<void> => {
      if (!isAuthenticated || !tokens?.accessToken) {
        throw new Error('Not authenticated');
      }

      const url = endpoint
        ? `${API_URL}/api/emails/${emailId}/${endpoint}`
        : `${API_URL}/api/emails/${emailId}`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to ${action} email`);
      }
    },
    [isAuthenticated, tokens?.accessToken]
  );

  /**
   * Archive an email
   */
  const archiveEmail = useCallback(
    async (emailId: string): Promise<void> => {
      // Optimistic update
      setEmails((prev) =>
        prev.map((email) =>
          email.id === emailId ? { ...email, category: 'archived' } : email
        )
      );

      try {
        await performEmailAction(emailId, 'archive', 'POST', 'archive');
      } catch (err) {
        // Rollback on error
        await refresh();
        throw err;
      }
    },
    [performEmailAction, refresh]
  );

  /**
   * Unarchive an email
   */
  const unarchiveEmail = useCallback(
    async (emailId: string): Promise<void> => {
      // Optimistic update
      setEmails((prev) =>
        prev.map((email) =>
          email.id === emailId ? { ...email, category: null } : email
        )
      );

      try {
        await performEmailAction(emailId, 'unarchive', 'DELETE', 'archive');
      } catch (err) {
        await refresh();
        throw err;
      }
    },
    [performEmailAction, refresh]
  );

  /**
   * Delete an email
   */
  const deleteEmail = useCallback(
    async (emailId: string): Promise<void> => {
      // Optimistic update - remove from list
      setEmails((prev) => prev.filter((email) => email.id !== emailId));

      try {
        await performEmailAction(emailId, 'delete', 'DELETE');
      } catch (err) {
        await refresh();
        throw err;
      }
    },
    [performEmailAction, refresh]
  );

  /**
   * Mark email as read
   */
  const markAsRead = useCallback(
    async (emailId: string): Promise<void> => {
      // Optimistic update
      setEmails((prev) =>
        prev.map((email) =>
          email.id === emailId ? { ...email, isRead: true } : email
        )
      );

      try {
        await performEmailAction(emailId, 'mark as read', 'POST', 'read');
      } catch (err) {
        await refresh();
        throw err;
      }
    },
    [performEmailAction, refresh]
  );

  /**
   * Mark email as unread
   */
  const markAsUnread = useCallback(
    async (emailId: string): Promise<void> => {
      // Optimistic update
      setEmails((prev) =>
        prev.map((email) =>
          email.id === emailId ? { ...email, isRead: false } : email
        )
      );

      try {
        await performEmailAction(emailId, 'mark as unread', 'DELETE', 'read');
      } catch (err) {
        await refresh();
        throw err;
      }
    },
    [performEmailAction, refresh]
  );

  /**
   * Star an email
   */
  const starEmail = useCallback(
    async (emailId: string): Promise<void> => {
      // Optimistic update
      setEmails((prev) =>
        prev.map((email) =>
          email.id === emailId ? { ...email, isStarred: true } : email
        )
      );

      try {
        // Star endpoint - PATCH to main email endpoint
        await performEmailAction(emailId, 'star', 'PATCH');
      } catch (err) {
        await refresh();
        throw err;
      }
    },
    [performEmailAction, refresh]
  );

  /**
   * Unstar an email
   */
  const unstarEmail = useCallback(
    async (emailId: string): Promise<void> => {
      // Optimistic update
      setEmails((prev) =>
        prev.map((email) =>
          email.id === emailId ? { ...email, isStarred: false } : email
        )
      );

      try {
        await performEmailAction(emailId, 'unstar', 'PATCH');
      } catch (err) {
        await refresh();
        throw err;
      }
    },
    [performEmailAction, refresh]
  );

  /**
   * Change category filter
   */
  const handleSetCategory = useCallback((newCategory: EmailCategory): void => {
    setCategory(newCategory);
  }, []);

  return {
    // State
    emails,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    hasMore,
    total,
    // Actions
    refresh,
    loadMore,
    archiveEmail,
    unarchiveEmail,
    deleteEmail,
    markAsRead,
    markAsUnread,
    starEmail,
    unstarEmail,
    setCategory: handleSetCategory,
  };
}

export default useEmails;
