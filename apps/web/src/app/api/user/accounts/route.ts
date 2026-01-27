/**
 * User Connected Accounts API Routes
 *
 * Handles user's connected email accounts:
 * - GET /api/user/accounts - List connected email accounts
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, type EmailAccount } from "@/lib/prisma";

/**
 * Response structure for connected accounts
 */
interface AccountsListResponse {
  accounts: EmailAccount[];
}

/**
 * GET /api/user/accounts
 * List connected email accounts for the authenticated user
 */
export async function GET(): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to access accounts" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch user's connected email accounts
    const accounts = await prisma.emailAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    const response: AccountsListResponse = {
      accounts,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API] GET /api/user/accounts failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}
