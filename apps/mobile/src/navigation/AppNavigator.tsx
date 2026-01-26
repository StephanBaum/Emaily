/**
 * Navigation utilities and type definitions for the Email AI mobile app
 *
 * This file provides:
 * - Type-safe route definitions
 * - Navigation helper hooks
 * - Route constants
 *
 * Expo Router handles the actual navigation via file-based routing.
 * This file provides additional utilities and type safety.
 */

import { router, useSegments, useRootNavigationState } from 'expo-router';
import { useEffect, useCallback } from 'react';

/**
 * Route path constants
 *
 * Use these constants for type-safe navigation instead of raw strings.
 */
export const Routes = {
  // Auth routes
  AUTH: {
    LOGIN: '/(auth)/login',
  },
  // Main app routes (tabs)
  TABS: {
    ROOT: '/(tabs)',
    INBOX: '/(tabs)/',
    COMPOSE: '/(tabs)/compose',
    SETTINGS: '/(tabs)/settings',
  },
  // Email detail route
  EMAIL: {
    DETAIL: '/email/[id]',
  },
} as const;

/**
 * Route parameter types
 */
export interface EmailDetailParams {
  id: string;
}

/**
 * Navigation state type
 */
export interface NavigationState {
  isReady: boolean;
  currentRoute: string | undefined;
}

/**
 * Hook to check if navigation is ready
 *
 * Use this hook to ensure navigation actions are only
 * performed after the navigation state is initialized.
 */
export function useNavigationReady(): boolean {
  const rootNavigationState = useRootNavigationState();
  return rootNavigationState?.key !== undefined;
}

/**
 * Hook to get current route segments
 *
 * Returns the current URL segments for conditional rendering
 * or navigation-aware logic.
 */
export function useCurrentRoute(): string[] {
  return useSegments();
}

/**
 * Hook for protected route handling
 *
 * This hook redirects unauthenticated users to the login screen
 * and authenticated users away from auth screens.
 *
 * @param isAuthenticated - Whether the user is currently authenticated
 */
export function useProtectedRoute(isAuthenticated: boolean): void {
  const segments = useSegments();
  const navigationReady = useNavigationReady();

  useEffect(() => {
    if (!navigationReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated and not in auth group
      router.replace(Routes.AUTH.LOGIN);
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to main app if authenticated and in auth group
      router.replace(Routes.TABS.ROOT);
    }
  }, [isAuthenticated, segments, navigationReady]);
}

/**
 * Navigation helper functions
 *
 * Provides type-safe navigation methods using Expo Router.
 */
export const Navigation = {
  /**
   * Navigate to email detail screen
   */
  toEmailDetail: (emailId: string): void => {
    router.push(`/email/${emailId}`);
  },

  /**
   * Navigate to compose screen
   */
  toCompose: (): void => {
    router.push(Routes.TABS.COMPOSE);
  },

  /**
   * Navigate to inbox
   */
  toInbox: (): void => {
    router.push(Routes.TABS.INBOX);
  },

  /**
   * Navigate to settings
   */
  toSettings: (): void => {
    router.push(Routes.TABS.SETTINGS);
  },

  /**
   * Navigate to login
   */
  toLogin: (): void => {
    router.replace(Routes.AUTH.LOGIN);
  },

  /**
   * Go back to previous screen
   */
  goBack: (): void => {
    if (router.canGoBack()) {
      router.back();
    }
  },

  /**
   * Reset navigation to a specific route
   */
  reset: (route: string): void => {
    router.replace(route);
  },
} as const;

/**
 * Hook to create navigation handlers with callbacks
 *
 * Useful for wrapping navigation with side effects like analytics.
 */
export function useNavigationHandlers(
  onNavigate?: (route: string) => void
): typeof Navigation {
  const toEmailDetail = useCallback(
    (emailId: string) => {
      onNavigate?.(`/email/${emailId}`);
      Navigation.toEmailDetail(emailId);
    },
    [onNavigate]
  );

  const toCompose = useCallback(() => {
    onNavigate?.(Routes.TABS.COMPOSE);
    Navigation.toCompose();
  }, [onNavigate]);

  const toInbox = useCallback(() => {
    onNavigate?.(Routes.TABS.INBOX);
    Navigation.toInbox();
  }, [onNavigate]);

  const toSettings = useCallback(() => {
    onNavigate?.(Routes.TABS.SETTINGS);
    Navigation.toSettings();
  }, [onNavigate]);

  const toLogin = useCallback(() => {
    onNavigate?.(Routes.AUTH.LOGIN);
    Navigation.toLogin();
  }, [onNavigate]);

  return {
    toEmailDetail,
    toCompose,
    toInbox,
    toSettings,
    toLogin,
    goBack: Navigation.goBack,
    reset: Navigation.reset,
  };
}

// Re-export expo-router hooks for convenience
export { router, useRouter, useLocalSearchParams, useSegments } from 'expo-router';
