/**
 * OAuth Token Verification
 *
 * This module provides server-side verification of OAuth tokens from Google and Microsoft.
 * It validates that tokens are genuine by fetching user profiles directly from the OAuth providers,
 * ensuring the token actually belongs to the claimed email address.
 *
 * SECURITY: This prevents authentication bypass attacks where an attacker might provide
 * a valid token for one account but claim a different email address.
 */

/**
 * Verified user profile returned from OAuth provider
 */
export interface VerifiedProfile {
  /** User's email address from OAuth provider */
  email: string;
  /** Whether the email is verified by the provider */
  verified: boolean;
  /** User's display name (optional) */
  name?: string;
}

/**
 * Verify a Google OAuth access token
 *
 * Fetches user profile from Google's userinfo endpoint to verify the token
 * and extract the authenticated user's email address.
 *
 * @param accessToken - Google OAuth access token to verify
 * @returns Verified user profile if valid, null if invalid or error occurs
 *
 * @example
 * ```typescript
 * const profile = await verifyGoogleToken(accessToken);
 * if (profile && profile.email === claimedEmail) {
 *   // Token is valid and matches claimed email
 * }
 * ```
 */
export async function verifyGoogleToken(
  accessToken: string
): Promise<VerifiedProfile | null> {
  try {
    const response = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(10000), // 10 second timeout
      }
    );

    // Invalid token returns 401
    if (response.status === 401) {
      return null;
    }

    // Rate limiting returns 429
    if (response.status === 429) {
      return null;
    }

    // Other errors
    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Validate response structure
    if (!data.email || typeof data.email !== "string") {
      return null;
    }

    return {
      email: data.email,
      verified: data.verified_email === true,
      name: data.name || undefined,
    };
  } catch (error) {
    // Network errors, timeouts, parsing errors - all return null
    // Silently fail to avoid leaking information
    return null;
  }
}

/**
 * Verify a Microsoft OAuth access token
 *
 * Fetches user profile from Microsoft Graph API to verify the token
 * and extract the authenticated user's email address.
 *
 * @param accessToken - Microsoft OAuth access token to verify
 * @returns Verified user profile if valid, null if invalid or error occurs
 *
 * @example
 * ```typescript
 * const profile = await verifyMicrosoftToken(accessToken);
 * if (profile && profile.email === claimedEmail) {
 *   // Token is valid and matches claimed email
 * }
 * ```
 */
export async function verifyMicrosoftToken(
  accessToken: string
): Promise<VerifiedProfile | null> {
  try {
    const response = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    // Invalid token returns 401
    if (response.status === 401) {
      return null;
    }

    // Rate limiting returns 429
    if (response.status === 429) {
      return null;
    }

    // Other errors
    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Extract email from mail or userPrincipalName
    const email = data.mail || data.userPrincipalName;

    // Validate email exists
    if (!email || typeof email !== "string") {
      return null;
    }

    return {
      email,
      // Microsoft accounts are verified by definition
      verified: true,
      name: data.displayName || undefined,
    };
  } catch (error) {
    // Network errors, timeouts, parsing errors - all return null
    // Silently fail to avoid leaking information
    return null;
  }
}

/**
 * Verify an OAuth token for any supported provider
 *
 * Unified function that routes to the appropriate provider-specific verification function.
 * This is the main entry point for token verification in the API endpoints.
 *
 * @param provider - OAuth provider ('google' or 'microsoft')
 * @param accessToken - OAuth access token to verify
 * @returns Verified user profile if valid, null if invalid or error occurs
 *
 * @example
 * ```typescript
 * const profile = await verifyOAuthToken('google', accessToken);
 * if (!profile) {
 *   return res.status(401).json({ error: 'Invalid token' });
 * }
 * if (profile.email !== claimedEmail) {
 *   return res.status(403).json({ error: 'Email mismatch' });
 * }
 * // Token is valid and matches claimed email - proceed
 * ```
 */
export async function verifyOAuthToken(
  provider: "google" | "microsoft",
  accessToken: string
): Promise<VerifiedProfile | null> {
  if (provider === "google") {
    return verifyGoogleToken(accessToken);
  } else if (provider === "microsoft") {
    return verifyMicrosoftToken(accessToken);
  }

  // Unknown provider
  return null;
}
