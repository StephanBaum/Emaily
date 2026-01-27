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
import { prisma, encryptOAuthToken } from "@email-ai/database";
import { createMobileSession } from "@/lib/mobile-session";

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
 * Map provider to email account provider type
 */
function mapProviderToEmailProvider(provider: "google" | "microsoft"): string {
  return provider === "google" ? "gmail" : "outlook";
}

/**
 * POST /api/mobile/auth/sync
 * Sync mobile OAuth tokens with backend
 */
export async function POST(request: NextRequest): Promise<NextResponse<MobileAuthSyncResponse>> {
  try {
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

    // Map provider to email provider type
    const emailProvider = mapProviderToEmailProvider(body.provider);

    // Encrypt OAuth tokens before storing in database
    // accessToken is guaranteed to exist due to validation above
    const encryptedAccessToken = encryptOAuthToken(body.accessToken)!;
    const encryptedRefreshToken = encryptOAuthToken(body.refreshToken);

    // Find existing email account or create new one
    let emailAccount = await prisma.emailAccount.findFirst({
      where: {
        userId: user.id,
        provider: emailProvider,
      },
    });

    if (emailAccount) {
      // Update existing email account with new encrypted tokens
      emailAccount = await prisma.emailAccount.update({
        where: { id: emailAccount.id },
        data: {
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken ?? emailAccount.refreshToken,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new email account with encrypted tokens
      emailAccount = await prisma.emailAccount.create({
        data: {
          userId: user.id,
          provider: emailProvider,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken ?? undefined,
        },
      });
    }

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
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Sync failed: ${message}` },
      { status: 500 }
    );
  }
}
