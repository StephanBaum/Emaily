import { useCallback, useEffect, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

// Ensure web browser is warmed up for authentication
WebBrowser.maybeCompleteAuthSession();

/**
 * User information from OAuth provider
 */
export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  provider: 'google' | 'microsoft';
}

/**
 * OAuth token information
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}

/**
 * Authentication state
 */
export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
}

/**
 * Authentication actions
 */
export interface AuthActions {
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshTokens: () => Promise<void>;
}

export type UseAuthReturn = AuthState & AuthActions;

// OAuth configuration from environment variables
const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

// Microsoft OAuth configuration
const MICROSOFT_CLIENT_ID = process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID || '';
const MICROSOFT_TENANT = process.env.EXPO_PUBLIC_MICROSOFT_TENANT || 'common';
const MICROSOFT_DISCOVERY = {
  authorizationEndpoint: `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/token`,
  revocationEndpoint: `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/logout`,
};

// Storage keys
const STORAGE_KEYS = {
  USER: '@email-ai/user',
  TOKENS: '@email-ai/tokens',
} as const;

/**
 * Simple async storage abstraction
 * In production, consider using expo-secure-store for tokens
 */
const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      // Using AsyncStorage-like interface
      // In production, swap with expo-secure-store for sensitive data
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Silently fail
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Silently fail
    }
  },
};

/**
 * Fetch user profile from OAuth provider
 */
async function fetchUserProfile(
  provider: 'google' | 'microsoft',
  accessToken: string
): Promise<User | null> {
  try {
    if (provider === 'google') {
      const response = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch Google user profile');
      }

      const data = await response.json();
      return {
        id: data.id,
        email: data.email,
        name: data.name || null,
        image: data.picture || null,
        provider: 'google',
      };
    } else if (provider === 'microsoft') {
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Microsoft user profile');
      }

      const data = await response.json();
      return {
        id: data.id,
        email: data.mail || data.userPrincipalName,
        name: data.displayName || null,
        image: null, // Microsoft Graph photo requires separate request
        provider: 'microsoft',
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Sync tokens with backend API
 */
async function syncWithBackend(tokens: AuthTokens, user: User): Promise<void> {
  try {
    await fetch(`${API_URL}/api/mobile/auth/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        provider: user.provider,
        email: user.email,
      }),
    });
  } catch {
    // Silently fail - offline-first approach
  }
}

/**
 * useAuth hook for OAuth authentication
 *
 * Provides authentication state and actions for Google and Microsoft OAuth.
 * Handles token storage, refresh, and user profile fetching.
 *
 * @example
 * ```tsx
 * const { isAuthenticated, user, signInWithGoogle, signOut } = useAuth();
 *
 * if (!isAuthenticated) {
 *   return <LoginScreen />;
 * }
 *
 * return <Text>Welcome, {user?.name}</Text>;
 * ```
 */
export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    tokens: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  // Get redirect URI for OAuth callback
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'emailai',
    path: 'auth/callback',
  });

  // Google OAuth request
  const [googleRequest, googleResponse, googlePromptAsync] =
    AuthSession.useAuthRequest(
      {
        clientId: GOOGLE_CLIENT_ID,
        scopes: [
          'openid',
          'profile',
          'email',
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.modify',
        ],
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
        extraParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
      GOOGLE_DISCOVERY
    );

  // Microsoft OAuth request
  const [microsoftRequest, microsoftResponse, microsoftPromptAsync] =
    AuthSession.useAuthRequest(
      {
        clientId: MICROSOFT_CLIENT_ID,
        scopes: [
          'openid',
          'profile',
          'email',
          'offline_access',
          'Mail.Read',
          'Mail.ReadWrite',
          'Mail.Send',
        ],
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
      },
      MICROSOFT_DISCOVERY
    );

  /**
   * Load stored authentication state on mount
   */
  useEffect(() => {
    async function loadStoredAuth(): Promise<void> {
      try {
        const userJson = await storage.getItem(STORAGE_KEYS.USER);
        const tokensJson = await storage.getItem(STORAGE_KEYS.TOKENS);

        if (userJson && tokensJson) {
          const user = JSON.parse(userJson) as User;
          const tokens = JSON.parse(tokensJson) as AuthTokens;

          // Check if tokens are expired
          if (tokens.expiresAt && tokens.expiresAt < Date.now()) {
            // Tokens expired, try to refresh
            if (tokens.refreshToken) {
              // TODO: Implement token refresh
              await storage.removeItem(STORAGE_KEYS.USER);
              await storage.removeItem(STORAGE_KEYS.TOKENS);
            } else {
              // No refresh token, clear stored data
              await storage.removeItem(STORAGE_KEYS.USER);
              await storage.removeItem(STORAGE_KEYS.TOKENS);
            }
          } else {
            setState({
              user,
              tokens,
              isLoading: false,
              isAuthenticated: true,
              error: null,
            });
            return;
          }
        }
      } catch {
        // Clear potentially corrupted data
        await storage.removeItem(STORAGE_KEYS.USER);
        await storage.removeItem(STORAGE_KEYS.TOKENS);
      }

      setState((prev) => ({ ...prev, isLoading: false }));
    }

    loadStoredAuth();
  }, []);

  /**
   * Handle Google OAuth response
   */
  useEffect(() => {
    async function handleGoogleResponse(): Promise<void> {
      if (googleResponse?.type === 'success' && googleResponse.params.code) {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        try {
          // Exchange code for tokens
          const tokenResponse = await AuthSession.exchangeCodeAsync(
            {
              clientId: GOOGLE_CLIENT_ID,
              code: googleResponse.params.code,
              redirectUri,
              extraParams: {
                code_verifier: googleRequest?.codeVerifier || '',
              },
            },
            GOOGLE_DISCOVERY
          );

          const tokens: AuthTokens = {
            accessToken: tokenResponse.accessToken,
            refreshToken: tokenResponse.refreshToken || null,
            expiresAt: tokenResponse.expiresIn
              ? Date.now() + tokenResponse.expiresIn * 1000
              : null,
          };

          // Fetch user profile
          const user = await fetchUserProfile('google', tokens.accessToken);

          if (!user) {
            throw new Error('Failed to fetch user profile');
          }

          // Store auth data
          await storage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
          await storage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokens));

          // Sync with backend
          await syncWithBackend(tokens, user);

          setState({
            user,
            tokens,
            isLoading: false,
            isAuthenticated: true,
            error: null,
          });
        } catch (error) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error:
              error instanceof Error
                ? error
                : new Error('Authentication failed'),
          }));
        }
      } else if (googleResponse?.type === 'error') {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: new Error(
            googleResponse.error?.message || 'Google sign-in failed'
          ),
        }));
      }
    }

    handleGoogleResponse();
  }, [googleResponse, googleRequest?.codeVerifier, redirectUri]);

  /**
   * Handle Microsoft OAuth response
   */
  useEffect(() => {
    async function handleMicrosoftResponse(): Promise<void> {
      if (
        microsoftResponse?.type === 'success' &&
        microsoftResponse.params.code
      ) {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        try {
          // Exchange code for tokens
          const tokenResponse = await AuthSession.exchangeCodeAsync(
            {
              clientId: MICROSOFT_CLIENT_ID,
              code: microsoftResponse.params.code,
              redirectUri,
              extraParams: {
                code_verifier: microsoftRequest?.codeVerifier || '',
              },
            },
            MICROSOFT_DISCOVERY
          );

          const tokens: AuthTokens = {
            accessToken: tokenResponse.accessToken,
            refreshToken: tokenResponse.refreshToken || null,
            expiresAt: tokenResponse.expiresIn
              ? Date.now() + tokenResponse.expiresIn * 1000
              : null,
          };

          // Fetch user profile
          const user = await fetchUserProfile('microsoft', tokens.accessToken);

          if (!user) {
            throw new Error('Failed to fetch user profile');
          }

          // Store auth data
          await storage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
          await storage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokens));

          // Sync with backend
          await syncWithBackend(tokens, user);

          setState({
            user,
            tokens,
            isLoading: false,
            isAuthenticated: true,
            error: null,
          });
        } catch (error) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error:
              error instanceof Error
                ? error
                : new Error('Authentication failed'),
          }));
        }
      } else if (microsoftResponse?.type === 'error') {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: new Error(
            microsoftResponse.error?.message || 'Microsoft sign-in failed'
          ),
        }));
      }
    }

    handleMicrosoftResponse();
  }, [microsoftResponse, microsoftRequest?.codeVerifier, redirectUri]);

  /**
   * Sign in with Google OAuth
   */
  const signInWithGoogle = useCallback(async (): Promise<void> => {
    if (!googleRequest) {
      setState((prev) => ({
        ...prev,
        error: new Error('Google OAuth not configured'),
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    await googlePromptAsync();
  }, [googleRequest, googlePromptAsync]);

  /**
   * Sign in with Microsoft OAuth
   */
  const signInWithMicrosoft = useCallback(async (): Promise<void> => {
    if (!microsoftRequest) {
      setState((prev) => ({
        ...prev,
        error: new Error('Microsoft OAuth not configured'),
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    await microsoftPromptAsync();
  }, [microsoftRequest, microsoftPromptAsync]);

  /**
   * Sign out and clear stored data
   */
  const signOut = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // Clear stored auth data
      await storage.removeItem(STORAGE_KEYS.USER);
      await storage.removeItem(STORAGE_KEYS.TOKENS);

      // Notify backend
      await fetch(`${API_URL}/api/mobile/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // Continue with sign out even if backend call fails
    }

    setState({
      user: null,
      tokens: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
    });
  }, []);

  /**
   * Refresh access tokens
   */
  const refreshTokens = useCallback(async (): Promise<void> => {
    if (!state.tokens?.refreshToken || !state.user) {
      setState((prev) => ({
        ...prev,
        error: new Error('No refresh token available'),
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const discovery =
        state.user.provider === 'google'
          ? GOOGLE_DISCOVERY
          : MICROSOFT_DISCOVERY;
      const clientId =
        state.user.provider === 'google' ? GOOGLE_CLIENT_ID : MICROSOFT_CLIENT_ID;

      const response = await AuthSession.refreshAsync(
        {
          clientId,
          refreshToken: state.tokens.refreshToken,
        },
        discovery
      );

      const newTokens: AuthTokens = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken || state.tokens.refreshToken,
        expiresAt: response.expiresIn
          ? Date.now() + response.expiresIn * 1000
          : null,
      };

      await storage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(newTokens));

      // Sync with backend
      await syncWithBackend(newTokens, state.user);

      setState((prev) => ({
        ...prev,
        tokens: newTokens,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      // Token refresh failed, sign out
      await signOut();
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error ? error : new Error('Token refresh failed'),
      }));
    }
  }, [state.tokens, state.user, signOut]);

  /**
   * Monitor token expiry and refresh automatically
   * Refreshes tokens 5 minutes before expiration
   */
  useEffect(() => {
    // Only set up monitoring if authenticated with valid tokens
    if (!state.isAuthenticated || !state.tokens?.expiresAt || !state.tokens?.refreshToken) {
      return;
    }

    const checkAndRefreshToken = (): void => {
      const expiresAt = state.tokens?.expiresAt;
      if (!expiresAt) {
        return;
      }

      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;
      const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

      // If token expires in less than 5 minutes, refresh it
      if (timeUntilExpiry < fiveMinutes && timeUntilExpiry > 0) {
        refreshTokens();
      }
    };

    // Check immediately on mount/auth change
    checkAndRefreshToken();

    // Set up interval to check every minute
    const intervalId = setInterval(checkAndRefreshToken, 60 * 1000);

    // Cleanup interval on unmount or auth state change
    return () => {
      clearInterval(intervalId);
    };
  }, [state.isAuthenticated, state.tokens, refreshTokens]);

  return {
    ...state,
    signInWithGoogle,
    signInWithMicrosoft,
    signOut,
    refreshTokens,
  };
}

/**
 * AuthContext for providing auth state to the entire app
 * Usage with React Context pattern for cleaner access
 */
export { useAuth as default };
