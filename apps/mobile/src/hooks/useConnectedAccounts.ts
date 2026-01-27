import { useCallback, useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { useAuthContext } from '../contexts/AuthContext';

/**
 * API URL from app configuration
 */
const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

/**
 * Connected email account as returned from the API
 */
export interface ConnectedAccount {
  id: string;
  provider: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Response from the connected accounts API
 */
interface AccountsApiResponse {
  accounts: ConnectedAccount[];
}

/**
 * State returned by the useConnectedAccounts hook
 */
export interface UseConnectedAccountsState {
  accounts: ConnectedAccount[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
}

/**
 * Actions returned by the useConnectedAccounts hook
 */
export interface UseConnectedAccountsActions {
  refresh: () => Promise<void>;
  disconnectAccount: (accountId: string) => Promise<void>;
}

export type UseConnectedAccountsReturn = UseConnectedAccountsState & UseConnectedAccountsActions;

/**
 * useConnectedAccounts hook for fetching and managing connected email accounts
 *
 * Provides list of connected accounts with ability to disconnect.
 * Handles authentication via the auth context.
 *
 * @example
 * ```tsx
 * const {
 *   accounts,
 *   isLoading,
 *   refresh,
 *   disconnectAccount,
 * } = useConnectedAccounts();
 *
 * return (
 *   <FlatList
 *     data={accounts}
 *     onRefresh={refresh}
 *   />
 * );
 * ```
 */
export function useConnectedAccounts(): UseConnectedAccountsReturn {
  const { tokens, isAuthenticated } = useAuthContext();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track if component is mounted
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Fetch connected accounts from the API
   */
  const fetchAccounts = useCallback(
    async (isRefresh: boolean = false): Promise<void> => {
      if (!isAuthenticated || !tokens?.accessToken) {
        setError(new Error('Not authenticated'));
        setIsLoading(false);
        return;
      }

      try {
        if (isRefresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setError(null);

        const response = await fetch(`${API_URL}/api/user/accounts`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const data: AccountsApiResponse = await response.json();

        if (!isMountedRef.current) return;

        setAccounts(data.accounts);
      } catch (err) {
        if (!isMountedRef.current) return;

        const error = err instanceof Error ? err : new Error('Failed to fetch accounts');
        setError(error);
      } finally {
        if (!isMountedRef.current) return;

        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isAuthenticated, tokens?.accessToken]
  );

  /**
   * Refresh the accounts list
   */
  const refresh = useCallback(async (): Promise<void> => {
    await fetchAccounts(true);
  }, [fetchAccounts]);

  /**
   * Disconnect an email account
   */
  const disconnectAccount = useCallback(
    async (accountId: string): Promise<void> => {
      if (!isAuthenticated || !tokens?.accessToken) {
        throw new Error('Not authenticated');
      }

      try {
        const response = await fetch(
          `${API_URL}/api/user/accounts/${accountId}/disconnect`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tokens.accessToken}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        if (!isMountedRef.current) return;

        // Remove the disconnected account from the list
        setAccounts((prev) => prev.filter((account) => account.id !== accountId));
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to disconnect account');
        throw error;
      }
    },
    [isAuthenticated, tokens?.accessToken]
  );

  // Initial fetch
  useEffect(() => {
    if (isAuthenticated && tokens?.accessToken) {
      fetchAccounts(false);
    }
  }, [isAuthenticated, tokens?.accessToken, fetchAccounts]);

  return {
    accounts,
    isLoading,
    isRefreshing,
    error,
    refresh,
    disconnectAccount,
  };
}

export default useConnectedAccounts;
