import { useCallback, useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { useAuthContext } from '../contexts/AuthContext';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

export interface AISettings {
  aiProvider: string;
  openAiApiKey: string | null;
  apiKeyConfigured: boolean;
}

export interface AISettingsUpdate {
  aiProvider?: string;
  openAiApiKey?: string;
}

export interface UseAISettingsReturn {
  settings: AISettings | null;
  isLoading: boolean;
  isUpdating: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  updateSettings: (data: AISettingsUpdate) => Promise<void>;
}

export function useAISettings(): UseAISettingsReturn {
  const { tokens, isAuthenticated } = useAuthContext();
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchSettings = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || !tokens?.accessToken) {
      setError(new Error('Not authenticated'));
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/user/ai-settings`, {
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

      const data: AISettings = await response.json();
      if (isMountedRef.current) {
        setSettings(data);
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch AI settings'));
      }
    }
  }, [isAuthenticated, tokens?.accessToken]);

  useEffect(() => {
    if (isAuthenticated) {
      setIsLoading(true);
      fetchSettings().finally(() => {
        if (isMountedRef.current) setIsLoading(false);
      });
    } else {
      setIsLoading(false);
      setSettings(null);
    }
  }, [isAuthenticated, fetchSettings]);

  const refresh = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await fetchSettings();
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [fetchSettings]);

  const updateSettings = useCallback(
    async (data: AISettingsUpdate): Promise<void> => {
      if (!isAuthenticated || !tokens?.accessToken) {
        throw new Error('Not authenticated');
      }

      setIsUpdating(true);
      try {
        const response = await fetch(`${API_URL}/api/user/ai-settings`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.accessToken}`,
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const responseData: AISettings = await response.json();
        if (isMountedRef.current) {
          setSettings(responseData);
          setError(null);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update AI settings');
        if (isMountedRef.current) setError(error);
        throw error;
      } finally {
        if (isMountedRef.current) setIsUpdating(false);
      }
    },
    [isAuthenticated, tokens?.accessToken]
  );

  return {
    settings,
    isLoading,
    isUpdating,
    error,
    refresh,
    updateSettings,
  };
}

export default useAISettings;
