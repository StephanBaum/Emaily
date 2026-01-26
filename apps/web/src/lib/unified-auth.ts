/**
 * Unified Authentication Helper
 *
 * This module provides authentication that works for both:
 * 1. Web clients using Auth.js sessions (cookies)
 * 2. Mobile clients using Bearer tokens
 *
 * Use `getUnifiedAuth()` in API routes to authenticate requests from either platform.
 */

import { NextRequest } from "next/server";
import { auth } from "./auth";
import { verifyMobileSession } from "./mobile-session";

/**
 * Unified user session returned by authentication
 */
export interface UnifiedSession {
  /** User ID from database */
  userId: string;
  /** User email address */
  email: string;
  /** Authentication source */
  source: "web" | "mobile";
  /** OAuth provider (for mobile sessions) */
  provider?: string;
}

/**
 * Authentication result
 */
export type AuthResult =
  | { authenticated: true; session: UnifiedSession }
  | { authenticated: false; error: string };

/**
 * Get unified authentication from request
 *
 * This function checks for authentication in the following order:
 * 1. Auth.js session (for web clients with cookies)
 * 2. Bearer token in Authorization header (for mobile clients)
 *
 * @param request - The Next.js request object
 * @returns Authentication result with session or error
 *
 * @example
 * ```ts
 * export async function GET(request: NextRequest) {
 *   const auth = await getUnifiedAuth(request);
 *
 *   if (!auth.authenticated) {
 *     return NextResponse.json({ error: auth.error }, { status: 401 });
 *   }
 *
 *   const { userId, email, source } = auth.session;
 *   // Continue with authenticated request...
 * }
 * ```
 */
export async function getUnifiedAuth(request: NextRequest): Promise<AuthResult> {
  // 1. Try Auth.js session first (web clients)
  try {
    const session = await auth();

    if (session?.user?.id) {
      return {
        authenticated: true,
        session: {
          userId: session.user.id,
          email: session.user.email || "",
          source: "web",
        },
      };
    }
  } catch {
    // Auth.js session check failed, continue to Bearer token check
  }

  // 2. Try Bearer token (mobile clients)
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);

    // Verify the mobile session token
    const mobileSession = verifyMobileSession(token);

    if (mobileSession) {
      return {
        authenticated: true,
        session: {
          userId: mobileSession.userId,
          email: mobileSession.email,
          source: "mobile",
          provider: mobileSession.provider,
        },
      };
    }

    return {
      authenticated: false,
      error: "Invalid or expired mobile session token",
    };
  }

  return {
    authenticated: false,
    error: "No valid authentication found. Please sign in.",
  };
}

/**
 * Require authentication helper
 *
 * Throws an error if not authenticated, useful for route handlers
 * that need guaranteed authentication.
 *
 * @param request - The Next.js request object
 * @returns Unified session if authenticated
 * @throws Error if not authenticated
 *
 * @example
 * ```ts
 * export async function GET(request: NextRequest) {
 *   try {
 *     const session = await requireAuth(request);
 *     // session is guaranteed to exist here
 *   } catch (error) {
 *     return NextResponse.json({ error: error.message }, { status: 401 });
 *   }
 * }
 * ```
 */
export async function requireAuth(request: NextRequest): Promise<UnifiedSession> {
  const result = await getUnifiedAuth(request);

  if (!result.authenticated) {
    throw new Error(result.error);
  }

  return result.session;
}
