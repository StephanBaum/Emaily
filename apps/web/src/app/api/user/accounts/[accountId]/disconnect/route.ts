/**
 * Account Disconnect API Route
 *
 * Handles disconnecting user email accounts:
 * - DELETE /api/user/accounts/[accountId]/disconnect - Disconnect and remove an email account
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Route context with dynamic parameters
 */
interface RouteContext {
  params: Promise<{ accountId: string }>;
}

/**
 * DELETE /api/user/accounts/[accountId]/disconnect
 * Disconnect and remove an email account
 *
 * This will cascade delete all associated emails for this account.
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to disconnect accounts" },
        { status: 401 }
      );
    }

    const { accountId } = await context.params;
    const userId = session.user.id;

    // Validate accountId format (should be a cuid)
    if (!accountId || accountId.length < 20 || accountId.length > 30) {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid account ID format" },
        { status: 400 }
      );
    }

    // Verify account exists and belongs to user
    const account = await prisma.emailAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        userId: true,
        provider: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Not Found", message: "Account not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (account.userId !== userId) {
      return NextResponse.json(
        { error: "Forbidden", message: "You do not have permission to disconnect this account" },
        { status: 403 }
      );
    }

    // Delete the account (this will cascade delete all associated emails)
    await prisma.emailAccount.delete({
      where: { id: accountId },
    });

    return NextResponse.json({
      message: "Account disconnected successfully",
      accountId: account.id,
      provider: account.provider,
    });
  } catch (error) {
    console.error("[API] DELETE /api/user/accounts/[accountId]/disconnect failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to disconnect account" },
      { status: 500 }
    );
  }
}
