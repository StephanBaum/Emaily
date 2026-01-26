/**
 * Mobile Auth Logout API Route
 *
 * This endpoint handles mobile client logout.
 * It invalidates the session token on the server side.
 *
 * The client should:
 * 1. Call this endpoint with the session token in the Authorization header
 * 2. Clear the stored session token locally
 */

import { NextRequest, NextResponse } from "next/server";
import { invalidateMobileSession } from "@/lib/mobile-session";

/**
 * Response body for mobile auth logout
 */
interface MobileAuthLogoutResponse {
  success: boolean;
  message?: string;
}

/**
 * POST /api/mobile/auth/logout
 * Handle mobile client logout
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<MobileAuthLogoutResponse>> {
  try {
    // Get the session token from the Authorization header
    const authHeader = request.headers.get("authorization");

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      // Invalidate the session token on the server
      invalidateMobileSession(token);
    }

    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, message: `Logout failed: ${message}` },
      { status: 500 }
    );
  }
}
