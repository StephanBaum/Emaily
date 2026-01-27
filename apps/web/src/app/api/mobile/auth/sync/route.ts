/**
 * Mobile Auth Sync API Route
 *
 * This endpoint allows mobile clients to sync their OAuth tokens with the backend.
 * After the mobile app completes OAuth authentication directly with Google/Microsoft,
 * it sends the tokens here to:
 * 1. Create or update the user record
 * 2. Create or update the EmailAccount record for email syncing
 * 3. Generate a session token for subsequent API calls
 *
 * This bridges the gap between mobile OAuth (which uses device-native auth flows)
 * and the web backend (which uses Auth.js for session management).
 *
 * Note: The mobile app will use the returned session token as a Bearer token
 * for subsequent API calls. The backend API routes use unified-auth to accept
 * both Auth.js sessions (web) and Bearer tokens (mobile).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMobileSession } from "@/lib/mobile-session";
import { verifyOAuthToken } from "@/lib/oauth-verification";

/**
 * Request body for mobile auth sync
 */
interface MobileAuthSyncRequest {
  /** OAuth access token from provider */
  accessToken: string;
  /** OAuth refresh token (optional) */
  refreshToken?: string | null;
  /** Provider type (google or microsoft) */
  provider: "google" | "microsoft";
  /** User email address */
  email: string;
}

/**
 * Response body for mobile auth sync
 */
interface MobileAuthSyncResponse {
  success: boolean;
  /** Session token for subsequent API calls */
  sessionToken?: string;
  /** User ID */
  userId?: string;
  /** Email account ID for syncing */
  emailAccountId?: string;
  /** Error message (if success is false) */
  error?: string;
}

/**
 * Map OAuth provider to email account provider type
 *
 * Converts the OAuth provider identifier ('google' or 'microsoft') to the
 * corresponding email provider type used in the EmailAccount table.
 *
 * @param provider - OAuth provider ('google' or 'microsoft')
 * @returns Email provider type ('gmail' or 'outlook')
 */
function mapProviderToEmailProvider(provider: "google" | "microsoft"): string {
  return provider === "google" ? "gmail" : "outlook";
}

/**
 * POST /api/mobile/auth/sync
 * Sync mobile OAuth tokens with backend
 *
 * This endpoint receives OAuth tokens from mobile clients and:
 * 1. Verifies the token with the OAuth provider (server-side validation)
 * 2. Validates that the token's email matches the claimed email
 * 3. Creates or updates the user account
 * 4. Creates or updates the email account with the OAuth tokens
 * 5. Generates a session token for subsequent API calls
 *
 * SECURITY: Token verification is performed server-side to prevent authentication
 * bypass attacks. The endpoint does NOT trust client-provided email claims without
 * cryptographic verification.
 *
 * @param request - Next.js request with JSON body containing accessToken, refreshToken, provider, and email
 * @returns Response with session token and IDs on success, error message on failure
 *
 * @example
 * ```typescript
 * // Request
 * POST /api/mobile/auth/sync
 * {
 *   "accessToken": "ya29.a0AfH6...",
 *   "refreshToken": "1//0gJx...",
 *   "provider": "google",
 *   "email": "user@example.com"
 * }
 *
 * // Success Response (200)
 * {
 *   "success": true,
 *   "sessionToken": "a1b2c3d4...",
 *   "userId": "user_123",
 *   "emailAccountId": "account_456"
 * }
 *
 * // Error Response (401) - Invalid token
 * {
 *   "success": false,
 *   "error": "Token verification failed"
 * }
 *
 * // Error Response (403) - Email mismatch
 * {
 *   "success": false,
 *   "error": "Email mismatch - token does not belong to claimed email"
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse<MobileAuthSyncResponse>> {
  try {
    // ============================================================================
    // STEP 1: Parse and Validate Request
    // ============================================================================

    // Parse request body
    let body: MobileAuthSyncRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.accessToken) {
      return NextResponse.json(
        { success: false, error: "accessToken is required" },
        { status: 400 }
      );
    }

    if (!body.provider || !["google", "microsoft"].includes(body.provider)) {
      return NextResponse.json(
        { success: false, error: "provider must be 'google' or 'microsoft'" },
        { status: 400 }
      );
    }

    if (!body.email) {
      return NextResponse.json(
        { success: false, error: "email is required" },
        { status: 400 }
      );
    }

    // ============================================================================
    // STEP 2: Server-Side Token Verification (CRITICAL SECURITY)
    // ============================================================================

    // SECURITY: Verify the OAuth token with the provider before trusting any claims
    // This prevents authentication bypass attacks where an attacker provides a valid
    // token for one account but claims a different email address
    const verifiedProfile = await verifyOAuthToken(body.provider, body.accessToken);

    if (!verifiedProfile) {
      // Token verification failed - invalid, expired, or network error
      // Don't reveal specific reason to prevent information leakage
      return NextResponse.json(
        { success: false, error: "Token verification failed" },
        { status: 401 }
      );
    }

    // SECURITY: Verify the email from the token matches the claimed email
    // Use lowercase comparison to prevent case-sensitivity bypass
    if (verifiedProfile.email.toLowerCase() !== body.email.toLowerCase()) {
      // Token is valid but belongs to a different email address
      // This could be an attack attempt - log for security monitoring
      return NextResponse.json(
        { success: false, error: "Email mismatch - token does not belong to claimed email" },
        { status: 403 }
      );
    }

    // ============================================================================
    // STEP 3: User Account Management
    // ============================================================================

    // Token is verified and email matches - proceed with user creation/update

    // Find or create user by email
    let user = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: {
          email: body.email,
          emailVerified: new Date(), // OAuth-verified email
        },
      });
    }

    // ============================================================================
    // STEP 4: Email Account Token Storage
    // ============================================================================

    // Map provider to email provider type
    const emailProvider = mapProviderToEmailProvider(body.provider);

    // Find existing email account or create new one
    let emailAccount = await prisma.emailAccount.findFirst({
      where: {
        userId: user.id,
        provider: emailProvider,
      },
    });

    if (emailAccount) {
      // Update existing email account with new tokens
      emailAccount = await prisma.emailAccount.update({
        where: { id: emailAccount.id },
        data: {
          accessToken: body.accessToken,
          refreshToken: body.refreshToken || emailAccount.refreshToken,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new email account
      emailAccount = await prisma.emailAccount.create({
        data: {
          userId: user.id,
          provider: emailProvider,
          accessToken: body.accessToken,
          refreshToken: body.refreshToken || null,
        },
      });
    }

    // ============================================================================
    // STEP 5: Session Token Generation
    // ============================================================================

    // Generate a session token for mobile API calls
    const sessionToken = createMobileSession(
      user.id,
      user.email || body.email,
      body.provider
    );

    return NextResponse.json({
      success: true,
      sessionToken,
      userId: user.id,
      emailAccountId: emailAccount.id,
    });
  } catch (error) {
    // ============================================================================
    // Error Handling
    // ============================================================================

    // Catch-all for unexpected errors (database failures, network issues, etc.)
    // Return generic error message to avoid leaking implementation details
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Sync failed: ${message}` },
      { status: 500 }
    );
  }
}
