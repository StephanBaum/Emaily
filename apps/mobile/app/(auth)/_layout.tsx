import { Stack } from 'expo-router';

/**
 * Auth group layout
 *
 * This layout wraps all authentication-related screens
 * (login, register, forgot password, etc.)
 */
export default function AuthLayout(): JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen name="login" />
    </Stack>
  );
}
