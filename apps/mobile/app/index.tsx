import { Redirect } from 'expo-router';

/**
 * Entry point route
 *
 * This route handles the initial navigation logic.
 * In a real app, this would check authentication state
 * and redirect accordingly. For now, it redirects to
 * the main tabs.
 *
 * TODO: Add auth state check when authentication is implemented
 */
export default function Index(): JSX.Element {
  // TODO: Check authentication state
  // const isAuthenticated = useAuth();
  // if (!isAuthenticated) {
  //   return <Redirect href="/(auth)/login" />;
  // }

  return <Redirect href="/(tabs)" />;
}
