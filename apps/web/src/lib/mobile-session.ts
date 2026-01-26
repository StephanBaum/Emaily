/**
 * Mobile Session Management
 *
 * This module provides session management for mobile clients.
 * Mobile clients authenticate via OAuth directly with providers (Google/Microsoft)
 * and then sync their tokens with the backend via /api/mobile/auth/sync.
 *
 * Session tokens are stored in memory (use Redis in production for scalability).
 */

import crypto from "crypto";

/**
 * Mobile session data structure
 */
export interface MobileSession {
  userId: string;
  email: string;
  provider: string;
  expiresAt: number;
}

/**
 * In-memory session storage
 * In production, replace with Redis or database for persistence across instances
 */
const sessionStore = new Map<string, MobileSession>();

/**
 * Session expiration time (7 days in milliseconds)
 */
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Generate a secure random session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create a new mobile session
 *
 * @param userId - User ID from database
 * @param email - User email address
 * @param provider - OAuth provider (google or microsoft)
 * @returns Session token for the client
 */
export function createMobileSession(
  userId: string,
  email: string,
  provider: string
): string {
  const token = generateSessionToken();
  const expiresAt = Date.now() + SESSION_EXPIRY_MS;

  sessionStore.set(token, {
    userId,
    email,
    provider,
    expiresAt,
  });

  // Clean up expired sessions periodically
  cleanupExpiredSessions();

  return token;
}

/**
 * Verify a mobile session token
 *
 * @param token - Session token to verify
 * @returns Session data if valid, null if invalid or expired
 */
export function verifyMobileSession(
  token: string
): { userId: string; email: string; provider: string } | null {
  const session = sessionStore.get(token);

  if (!session) {
    return null;
  }

  // Check if session is expired
  if (session.expiresAt < Date.now()) {
    sessionStore.delete(token);
    return null;
  }

  return {
    userId: session.userId,
    email: session.email,
    provider: session.provider,
  };
}

/**
 * Invalidate a mobile session (for logout)
 *
 * @param token - Session token to invalidate
 */
export function invalidateMobileSession(token: string): void {
  sessionStore.delete(token);
}

/**
 * Clean up expired sessions from the store
 * Called automatically when creating new sessions
 */
function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [token, session] of sessionStore.entries()) {
    if (session.expiresAt < now) {
      sessionStore.delete(token);
    }
  }
}

/**
 * Get session store size (for debugging/monitoring)
 */
export function getSessionCount(): number {
  return sessionStore.size;
}
