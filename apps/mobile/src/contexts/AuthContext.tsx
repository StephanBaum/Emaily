import React, {
  createContext,
  useContext,
  type PropsWithChildren,
} from 'react';
import { useAuth, type UseAuthReturn } from '../hooks/useAuth';

/**
 * AuthContext provides authentication state throughout the app
 *
 * This context wraps the useAuth hook and provides it to all
 * child components, avoiding the need to call useAuth directly
 * in every component that needs auth state.
 */
const AuthContext = createContext<UseAuthReturn | null>(null);

/**
 * AuthProvider component that provides auth state to its children
 *
 * @example
 * ```tsx
 * // In your app root
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 *
 * // In any child component
 * const { user, signOut } = useAuthContext();
 * ```
 */
export function AuthProvider({ children }: PropsWithChildren): JSX.Element {
  const auth = useAuth();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

/**
 * useAuthContext hook for accessing auth state from context
 *
 * This hook must be used within an AuthProvider.
 *
 * @throws Error if used outside of AuthProvider
 * @returns Authentication state and actions
 */
export function useAuthContext(): UseAuthReturn {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }

  return context;
}

export { AuthContext };
