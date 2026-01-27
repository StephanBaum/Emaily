import { useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import {
  requestPermissions,
  registerForPushNotifications,
  unregisterFromPushNotifications,
  getNotificationPermissionStatus,
  getStoredPushToken,
  clearNotificationData,
  setNotificationHandler,
  setupNotificationChannels,
  handleNotificationReceived,
  handleNotificationResponse,
  isPushNotificationSupported,
  type NotificationPermissionStatus,
  type NotificationResponseData,
} from '../services/notifications';

/**
 * Notification state
 */
export interface NotificationState {
  isEnabled: boolean;
  permissionStatus: NotificationPermissionStatus;
  pushToken: string | null;
  isLoading: boolean;
  isSupported: boolean;
  error: Error | null;
  lastNotification: Notifications.Notification | null;
}

/**
 * Notification actions
 */
export interface NotificationActions {
  requestPermission: (accessToken?: string) => Promise<void>;
  unregister: (accessToken?: string) => Promise<void>;
  checkPermissionStatus: () => Promise<void>;
  clearError: () => void;
}

export type UseNotificationsReturn = NotificationState & NotificationActions;

/**
 * Notification navigation callback type
 */
export type NotificationNavigationCallback = (data: NotificationResponseData) => void;

/**
 * useNotifications hook for push notification management
 *
 * Provides notification state and actions for managing push notifications.
 * Handles permission requests, device registration, and notification listeners.
 *
 * @param options Configuration options
 * @param options.accessToken Optional access token for backend authentication
 * @param options.onNotificationTap Optional callback when notification is tapped
 * @param options.onNotificationReceived Optional callback when notification is received in foreground
 *
 * @example
 * ```tsx
 * const {
 *   isEnabled,
 *   permissionStatus,
 *   requestPermission,
 *   unregister
 * } = useNotifications({
 *   accessToken: user.accessToken,
 *   onNotificationTap: (data) => {
 *     if (data.emailId) {
 *       router.push(`/emails/${data.emailId}`);
 *     }
 *   }
 * });
 *
 * if (!isEnabled) {
 *   return (
 *     <Button onPress={() => requestPermission()}>
 *       Enable Notifications
 *     </Button>
 *   );
 * }
 * ```
 */
export function useNotifications(options?: {
  accessToken?: string;
  onNotificationTap?: NotificationNavigationCallback;
  onNotificationReceived?: (notification: Notifications.Notification) => void;
}): UseNotificationsReturn {
  const [state, setState] = useState<NotificationState>({
    isEnabled: false,
    permissionStatus: 'undetermined',
    pushToken: null,
    isLoading: true,
    isSupported: isPushNotificationSupported(),
    error: null,
    lastNotification: null,
  });

  // Store callbacks in refs to avoid recreating listeners
  const onNotificationTapRef = useRef(options?.onNotificationTap);
  const onNotificationReceivedRef = useRef(options?.onNotificationReceived);

  // Update refs when callbacks change
  useEffect(() => {
    onNotificationTapRef.current = options?.onNotificationTap;
    onNotificationReceivedRef.current = options?.onNotificationReceived;
  }, [options?.onNotificationTap, options?.onNotificationReceived]);

  /**
   * Initialize notification handler and channels
   */
  useEffect(() => {
    if (!state.isSupported) {
      return;
    }

    // Set up notification handler for foreground notifications
    setNotificationHandler();

    // Set up Android notification channels
    setupNotificationChannels().catch(() => {
      // Silently fail - not critical
    });
  }, [state.isSupported]);

  /**
   * Load stored notification state on mount
   */
  useEffect(() => {
    async function loadStoredState(): Promise<void> {
      if (!state.isSupported) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        const [permissionStatus, storedToken] = await Promise.all([
          getNotificationPermissionStatus(),
          getStoredPushToken(),
        ]);

        setState((prev) => ({
          ...prev,
          isEnabled: permissionStatus === 'granted' && storedToken !== null,
          permissionStatus,
          pushToken: storedToken,
          isLoading: false,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error
              ? error
              : new Error('Failed to load notification state'),
        }));
      }
    }

    loadStoredState();
  }, [state.isSupported]);

  /**
   * Set up notification received listener
   */
  useEffect(() => {
    if (!state.isSupported || !state.isEnabled) {
      return;
    }

    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        // Update state with last notification
        setState((prev) => ({ ...prev, lastNotification: notification }));

        // Call service handler for default behavior
        handleNotificationReceived(notification);

        // Call custom callback if provided
        if (onNotificationReceivedRef.current) {
          onNotificationReceivedRef.current(notification);
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [state.isSupported, state.isEnabled]);

  /**
   * Set up notification response listener (when user taps notification)
   */
  useEffect(() => {
    if (!state.isSupported) {
      return;
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        // Handle notification response with navigation callback
        handleNotificationResponse(response, (data) => {
          if (onNotificationTapRef.current) {
            onNotificationTapRef.current(data);
          }
        });
      }
    );

    return () => {
      subscription.remove();
    };
  }, [state.isSupported]);

  /**
   * Request notification permissions and register device
   */
  const requestPermission = useCallback(
    async (accessToken?: string): Promise<void> => {
      if (!state.isSupported) {
        setState((prev) => ({
          ...prev,
          error: new Error('Push notifications not supported on this device'),
        }));
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Request permissions from the user
        const { status, canAskAgain } = await requestPermissions();

        if (status !== 'granted') {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            permissionStatus: status,
            isEnabled: false,
            error: new Error(
              canAskAgain
                ? 'Notification permissions denied'
                : 'Notification permissions denied. Please enable in device settings.'
            ),
          }));
          return;
        }

        // Use provided token or get from options
        const token = accessToken || options?.accessToken;

        // If we have an access token, register with backend
        if (token) {
          try {
            const { success } = await registerForPushNotifications(token);

            if (!success) {
              throw new Error('Failed to register device with backend');
            }
          } catch (registrationError) {
            // If registration fails, still update local state but show error
            const storedToken = await getStoredPushToken();
            setState((prev) => ({
              ...prev,
              isLoading: false,
              permissionStatus: 'granted',
              isEnabled: true,
              pushToken: storedToken,
              error:
                registrationError instanceof Error
                  ? registrationError
                  : new Error('Failed to register device'),
            }));
            return;
          }
        }

        // Get the stored push token after registration
        const storedToken = await getStoredPushToken();

        setState({
          isEnabled: true,
          permissionStatus: 'granted',
          pushToken: storedToken,
          isLoading: false,
          isSupported: true,
          error: null,
          lastNotification: null,
        });
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error
              ? error
              : new Error('Failed to request notification permissions'),
        }));
      }
    },
    [state.isSupported, options?.accessToken]
  );

  /**
   * Unregister device from push notifications
   */
  const unregister = useCallback(
    async (accessToken?: string): Promise<void> => {
      if (!state.isSupported) {
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Use provided token or get from options
        const token = accessToken || options?.accessToken;

        // If we have an access token, unregister with backend
        if (token) {
          try {
            await unregisterFromPushNotifications(token, state.pushToken || undefined);
          } catch {
            // Continue with local cleanup even if backend call fails
          }
        }

        // Clear local notification data
        await clearNotificationData();

        setState({
          isEnabled: false,
          permissionStatus: 'undetermined',
          pushToken: null,
          isLoading: false,
          isSupported: true,
          error: null,
          lastNotification: null,
        });
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error
              ? error
              : new Error('Failed to unregister from notifications'),
        }));
      }
    },
    [state.isSupported, state.pushToken, options?.accessToken]
  );

  /**
   * Check current permission status
   */
  const checkPermissionStatus = useCallback(async (): Promise<void> => {
    if (!state.isSupported) {
      return;
    }

    try {
      const permissionStatus = await getNotificationPermissionStatus();
      const storedToken = await getStoredPushToken();

      setState((prev) => ({
        ...prev,
        permissionStatus,
        isEnabled: permissionStatus === 'granted' && storedToken !== null,
        pushToken: storedToken,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error
            : new Error('Failed to check permission status'),
      }));
    }
  }, [state.isSupported]);

  /**
   * Clear error state
   */
  const clearError = useCallback((): void => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    requestPermission,
    unregister,
    checkPermissionStatus,
    clearError,
  };
}

/**
 * Export as default for convenience
 */
export { useNotifications as default };
