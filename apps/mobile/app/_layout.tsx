import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/contexts/AuthContext';

/**
 * Root layout for the application
 *
 * This layout wraps all routes and provides:
 * - AuthProvider for authentication state
 * - SafeAreaProvider for safe area insets
 * - StatusBar configuration
 * - Root Stack navigator for auth/main flow
 */
export default function RootLayout(): JSX.Element {
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
