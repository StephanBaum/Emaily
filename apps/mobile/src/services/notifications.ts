import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API URL from app configuration
 */
const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

/**
 * Storage key for notification permission state
 */
const NOTIFICATION_PERMISSION_KEY = '@email-ai/notification-permission';

/**
 * Storage key for Expo push token
 */
const EXPO_PUSH_TOKEN_KEY = '@email-ai/expo-push-token';

/**
 * Simple async storage abstraction
 * In production, consider using expo-secure-store for tokens
 */
const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
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
 * Notification permission status
 */
export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

/**
 * Result from requesting notification permissions
 */
export interface NotificationPermissionResult {
  status: NotificationPermissionStatus;
  canAskAgain: boolean;
}

/**
 * Device registration request payload
 */
export interface DeviceRegistrationPayload {
  deviceToken: string;
  platform: 'ios' | 'android';
  expoToken?: string;
}

/**
 * Device registration response
 */
export interface DeviceRegistrationResponse {
  success: boolean;
  subscriptionId?: string;
}

/**
 * Configure notification handler for foreground notifications
 * This should be called once at app startup
 */
export function setNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Check current notification permission status
 *
 * @returns Current permission status
 */
export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();

  if (status === 'granted') {
    return 'granted';
  } else if (status === 'denied') {
    return 'denied';
  }

  return 'undetermined';
}

/**
 * Request notification permissions from the user
 *
 * @returns Permission result with status and whether we can ask again
 *
 * @example
 * ```ts
 * const { status, canAskAgain } = await requestPermissions();
 * if (status === 'granted') {
 *   // Permissions granted, proceed with registration
 * }
 * ```
 */
export async function requestPermissions(): Promise<NotificationPermissionResult> {
  // Check if running on a physical device
  if (!Device.isDevice) {
    throw new Error('Push notifications only work on physical devices');
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // Store permission status
    await storage.setItem(NOTIFICATION_PERMISSION_KEY, finalStatus);

    const permissionStatus: NotificationPermissionStatus =
      finalStatus === 'granted' ? 'granted' :
      finalStatus === 'denied' ? 'denied' : 'undetermined';

    return {
      status: permissionStatus,
      canAskAgain: finalStatus !== 'denied',
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Failed to request permissions: ${error.message}`
        : 'Failed to request notification permissions'
    );
  }
}

/**
 * Get Expo push token for the device
 *
 * This token is used by the Expo push notification service to send
 * notifications to this specific device.
 *
 * @param projectId Optional Expo project ID (falls back to Constants)
 * @returns Expo push token string
 *
 * @example
 * ```ts
 * const token = await getExpoPushToken();
 * console.log('Push token:', token);
 * ```
 */
export async function getExpoPushToken(projectId?: string): Promise<string> {
  if (!Device.isDevice) {
    throw new Error('Push notifications only work on physical devices');
  }

  try {
    // Get project ID from constants or parameter
    const expoPushTokenProjectId =
      projectId || Constants.expoConfig?.extra?.eas?.projectId;

    if (!expoPushTokenProjectId) {
      throw new Error('Expo project ID not found in app configuration');
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: expoPushTokenProjectId,
    });

    const token = tokenData.data;

    // Store token for future use
    await storage.setItem(EXPO_PUSH_TOKEN_KEY, token);

    return token;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Failed to get push token: ${error.message}`
        : 'Failed to get Expo push token'
    );
  }
}

/**
 * Register device for push notifications with the backend
 *
 * This sends the device token and Expo push token to the backend API
 * so it can send notifications to this device.
 *
 * @param accessToken User's access token for authentication
 * @param expoToken Expo push token (optional, will fetch if not provided)
 * @returns Registration response
 *
 * @example
 * ```ts
 * const { success } = await registerForPushNotifications(accessToken);
 * if (success) {
 *   console.log('Device registered successfully');
 * }
 * ```
 */
export async function registerForPushNotifications(
  accessToken: string,
  expoToken?: string
): Promise<DeviceRegistrationResponse> {
  if (!Device.isDevice) {
    throw new Error('Push notifications only work on physical devices');
  }

  try {
    // Get Expo push token if not provided
    const token = expoToken || (await getExpoPushToken());

    // Determine platform
    const platform: 'ios' | 'android' =
      Platform.OS === 'ios' ? 'ios' : 'android';

    // Prepare registration payload
    const payload: DeviceRegistrationPayload = {
      deviceToken: token,
      platform,
      expoToken: token,
    };

    // Register with backend API
    const response = await fetch(`${API_URL}/api/notifications/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Registration failed with status ${response.status}`
      );
    }

    const data = await response.json();

    return {
      success: true,
      subscriptionId: data.id,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Failed to register device: ${error.message}`
        : 'Failed to register for push notifications'
    );
  }
}

/**
 * Unregister device from push notifications
 *
 * Removes the device token from the backend so it no longer receives
 * push notifications.
 *
 * @param accessToken User's access token for authentication
 * @param deviceToken Device token to unregister (optional, uses stored token)
 * @returns Whether unregistration was successful
 */
export async function unregisterFromPushNotifications(
  accessToken: string,
  deviceToken?: string
): Promise<boolean> {
  try {
    // Get stored token if not provided
    const token = deviceToken || (await storage.getItem(EXPO_PUSH_TOKEN_KEY));

    if (!token) {
      // No token to unregister
      return true;
    }

    // Unregister with backend API
    const response = await fetch(`${API_URL}/api/notifications/unregister`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ deviceToken: token }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Unregistration failed with status ${response.status}`
      );
    }

    // Clear stored token
    await storage.removeItem(EXPO_PUSH_TOKEN_KEY);
    await storage.removeItem(NOTIFICATION_PERMISSION_KEY);

    return true;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Failed to unregister device: ${error.message}`
        : 'Failed to unregister from push notifications'
    );
  }
}

/**
 * Handler for when a notification is received while app is in foreground
 *
 * Use this with Notifications.addNotificationReceivedListener()
 *
 * @param notification The received notification
 *
 * @example
 * ```ts
 * Notifications.addNotificationReceivedListener((notification) => {
 *   handleNotificationReceived(notification);
 * });
 * ```
 */
export function handleNotificationReceived(
  notification: Notifications.Notification
): void {
  try {
    // Extract notification data
    const { request } = notification;
    const { content } = request;
    const { title, body, data } = content;

    // Log for debugging (remove in production or use proper logging)
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('Notification received:', { title, body, data });
    }

    // Handle any custom logic for received notifications
    // For example, you might want to:
    // - Update local state
    // - Show a custom in-app notification
    // - Play a custom sound
    // - Update badge count

    // The default behavior (showing alert) is handled by setNotificationHandler
  } catch (error) {
    // Silently fail - don't crash the app due to notification handling error
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('Error handling notification:', error);
    }
  }
}

/**
 * Notification response data structure
 */
export interface NotificationResponseData {
  emailId?: string;
  messageId?: string;
  priority?: number;
  category?: string;
  [key: string]: any;
}

/**
 * Handler for when a user taps on a notification
 *
 * Use this with Notifications.addNotificationResponseReceivedListener()
 *
 * @param response The notification response
 * @param onNavigate Callback to handle navigation (e.g., to email detail screen)
 *
 * @example
 * ```ts
 * Notifications.addNotificationResponseReceivedListener((response) => {
 *   handleNotificationResponse(response, (data) => {
 *     if (data.emailId) {
 *       router.push(`/emails/${data.emailId}`);
 *     }
 *   });
 * });
 * ```
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  onNavigate?: (data: NotificationResponseData) => void
): void {
  try {
    // Extract notification data
    const { notification } = response;
    const { request } = notification;
    const { content } = request;
    const data = content.data as NotificationResponseData;

    // Log for debugging (remove in production or use proper logging)
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('Notification tapped:', data);
    }

    // Call navigation callback if provided
    if (onNavigate && data) {
      onNavigate(data);
    }
  } catch (error) {
    // Silently fail - don't crash the app due to notification handling error
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('Error handling notification response:', error);
    }
  }
}

/**
 * Get stored Expo push token
 *
 * @returns Stored push token or null if not found
 */
export async function getStoredPushToken(): Promise<string | null> {
  return storage.getItem(EXPO_PUSH_TOKEN_KEY);
}

/**
 * Get stored notification permission status
 *
 * @returns Stored permission status or null if not found
 */
export async function getStoredPermissionStatus(): Promise<string | null> {
  return storage.getItem(NOTIFICATION_PERMISSION_KEY);
}

/**
 * Clear all stored notification data
 *
 * Useful for cleanup on logout
 */
export async function clearNotificationData(): Promise<void> {
  await storage.removeItem(EXPO_PUSH_TOKEN_KEY);
  await storage.removeItem(NOTIFICATION_PERMISSION_KEY);
}

/**
 * Check if device supports push notifications
 *
 * @returns Whether push notifications are supported
 */
export function isPushNotificationSupported(): boolean {
  return Device.isDevice && (Platform.OS === 'ios' || Platform.OS === 'android');
}

/**
 * Get notification channel ID for Android
 *
 * Android requires notification channels for API level 26+
 *
 * @returns Channel ID string
 */
export function getNotificationChannelId(): string {
  return 'default';
}

/**
 * Set up notification channels for Android
 *
 * This should be called once at app startup on Android devices
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
    });
  }
}

/**
 * Notification service exports
 */
export default {
  setNotificationHandler,
  getNotificationPermissionStatus,
  requestPermissions,
  getExpoPushToken,
  registerForPushNotifications,
  unregisterFromPushNotifications,
  handleNotificationReceived,
  handleNotificationResponse,
  getStoredPushToken,
  getStoredPermissionStatus,
  clearNotificationData,
  isPushNotificationSupported,
  getNotificationChannelId,
  setupNotificationChannels,
};
