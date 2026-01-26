"use client";

import { SessionProvider } from "next-auth/react";

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Client-side providers wrapper component.
 *
 * Wraps the application with necessary providers:
 * - SessionProvider: Enables next-auth/react hooks (useSession, signIn, signOut)
 */
export function Providers({ children }: ProvidersProps) {
  return <SessionProvider>{children}</SessionProvider>;
}
