import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from '../src/contexts/AuthContext';
import { Navigation } from '../src/navigation/AppNavigator';
import {
  handleNotificationResponse,
  type NotificationResponseData,
} from '../src/services/notifications';

/**
 * Root layout for the application
 *
 * This layout wraps all routes and provides:
 * - AuthProvider for authentication state
 * - SafeAreaProvider for safe area insets
 * - StatusBar configuration
 * - Root Stack navigator for auth/main flow
 * - Notification tap handling
 */
export default function RootLayout(): JSX.Element {
  const notificationResponseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    /**
     * Set up notification response listener
     *
     * This listener handles notification taps and navigates to the
     * appropriate screen based on the notification data.
     */
    notificationResponseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        handleNotificationResponse(response, (data: NotificationResponseData) => {
          // Navigate to email detail screen if emailId is present
          if (data.emailId) {
            Navigation.toEmailDetail(data.emailId);
          }
        });
      });

    // Cleanup listener on unmount
    return () => {
      if (notificationResponseListener.current) {
        Notifications.removeNotificationSubscription(
          notificationResponseListener.current
        );
      }
    };
  }, []);

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="email/[id]"
            options={{
              headerShown: true,
              headerTitle: 'Email',
              animation: 'slide_from_bottom',
            }}
          />
        </Stack>
      </SafeAreaProvider>
    </AuthProvider>
  );
}
