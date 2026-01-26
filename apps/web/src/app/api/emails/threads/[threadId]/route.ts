/**
 * Thread Email API Routes
 *
 * Handles operations on email threads:
 * - GET /api/emails/threads/[threadId] - Get all messages in a thread
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, type Email } from "@/lib/prisma";

/**
 * Route context with dynamic parameters
 */
interface RouteContext {
  params: Promise<{ threadId: string }>;
}

/**
 * Get all emails in a thread and verify ownership
 * Returns the emails if found and owned by user, null otherwise
 */
async function getThreadEmailsIfOwned(
  threadId: string,
  userId: string
): Promise<Email[] | null> {
  // Get user's email accounts
  const emailAccounts = await prisma.emailAccount.findMany({
    where: { userId },
    select: { id: true },
  });

  const accountIds = emailAccounts.map((a) => a.id);

  // Find all emails in the thread
  const emails = await prisma.email.findMany({
    where: { threadId },
    orderBy: { receivedAt: "asc" },
  });

  // Verify all emails belong to user's accounts
  if (emails.length === 0) {
    return null;
  }

  // Check if all emails belong to the user's accounts
  const allOwned = emails.every((email) => accountIds.includes(email.accountId));

  if (!allOwned) {
    return null;
  }

  return emails;
}

/**
 * GET /api/emails/threads/[threadId]
 * Get all messages in a thread
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to access emails" },
        { status: 401 }
      );
    }

    const { threadId } = await context.params;
    const userId = session.user.id;

    // Get thread emails and verify ownership
    const emails = await getThreadEmailsIfOwned(threadId, userId);

    if (!emails) {
      return NextResponse.json(
        { error: "Not Found", message: "Thread not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(emails);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
