import { useCallback, useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { useAuthContext } from '../contexts/AuthContext';

/**
 * API URL from app configuration
 */
const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

/**
 * User profile information
 */
export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  provider: 'google' | 'microsoft';
  createdAt: string;
  updatedAt: string;
}

/**
 * User profile update data
 */
export interface UserProfileUpdate {
  name?: string | null;
  image?: string | null;
}

/**
 * State returned by the useUserProfile hook
 */
export interface UseUserProfileState {
  profile: UserProfile | null;
  isLoading: boolean;
  isUpdating: boolean;
  error: Error | null;
}

/**
 * Actions returned by the useUserProfile hook
 */
export interface UseUserProfileActions {
  refresh: () => Promise<void>;
  updateProfile: (data: UserProfileUpdate) => Promise<void>;
}

export type UseUserProfileReturn = UseUserProfileState & UseUserProfileActions;

/**
 * useUserProfile hook for fetching and updating user profile
 *
 * Provides user profile data with fetch and update capabilities.
 * Handles authentication via the auth context.
 *
 * @example
 * ```tsx
 * const {
 *   profile,
 *   isLoading,
 *   updateProfile,
 *   refresh,
 * } = useUserProfile();
 *
 * return (
 *   <View>
 *     <Text>{profile?.name}</Text>
 *     <Button onPress={() => updateProfile({ name: 'New Name' })} />
 *   </View>
 * );
 * ```
 */
export function useUserProfile(): UseUserProfileReturn {
  const { tokens, isAuthenticated } = useAuthContext();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
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
   * Fetch user profile from the API
   */
  const fetchProfile = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || !tokens?.accessToken) {
      setError(new Error('Not authenticated'));
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/user/profile`, {
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
        throw new Error(errorData.error || `Failed to fetch profile: ${response.status}`);
      }

      const data: UserProfile = await response.json();

      if (!isMountedRef.current) return;

      setProfile(data);
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err : new Error('Failed to fetch profile'));
    }
  }, [isAuthenticated, tokens?.accessToken]);

  /**
   * Initial fetch on mount and when authentication changes
   */
  useEffect(() => {
    if (isAuthenticated) {
      setIsLoading(true);
      fetchProfile().finally(() => {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      });
    } else {
      setIsLoading(false);
      setProfile(null);
    }
  }, [isAuthenticated, fetchProfile]);

  /**
   * Refresh profile data
   */
  const refresh = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await fetchProfile();
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchProfile]);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(
    async (data: UserProfileUpdate): Promise<void> => {
      if (!isAuthenticated || !tokens?.accessToken) {
        throw new Error('Not authenticated');
      }

      if (!profile) {
        throw new Error('No profile loaded');
      }

      // Optimistic update
      const previousProfile = profile;
      setProfile({
        ...profile,
        ...data,
        updatedAt: new Date().toISOString(),
      });

      setIsUpdating(true);
      try {
        const response = await fetch(`${API_URL}/api/user/profile`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.accessToken}`,
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Authentication expired. Please sign in again.');
          }
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to update profile: ${response.status}`);
        }

        const responseData: UserProfile = await response.json();

        if (!isMountedRef.current) return;

        setProfile(responseData);
        setError(null);
      } catch (err) {
        // Rollback on error
        if (isMountedRef.current) {
          setProfile(previousProfile);
          const error = err instanceof Error ? err : new Error('Failed to update profile');
          setError(error);
          throw error;
        }
      } finally {
        if (isMountedRef.current) {
          setIsUpdating(false);
        }
      }
    },
    [isAuthenticated, tokens?.accessToken, profile]
  );

  return {
    // State
    profile,
    isLoading,
    isUpdating,
    error,
    // Actions
    refresh,
    updateProfile,
  };
}

export default useUserProfile;
