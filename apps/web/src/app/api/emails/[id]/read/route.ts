/**
 * Email Read Status API Route
 *
 * Handles marking emails as read/unread:
 * - POST /api/emails/[id]/read - Mark email as read
 * - DELETE /api/emails/[id]/read - Mark email as unread
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, type Email } from "@/lib/prisma";
import { createEmailProvider } from "@/lib/email/provider";
import type { EmailProvider, EmailOAuthTokens } from "@/lib/email/types";

/**
 * Route context with dynamic parameters
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Get email by ID with account info and verify ownership
 * Returns the email with account details if found and owned by user, null otherwise
 */
async function getEmailWithAccountIfOwned(
  emailId: string,
  userId: string
): Promise<(Email & { account: { id: string; provider: string; accessToken: string; refreshToken: string | null } }) | null> {
  // Get user's email accounts
  const emailAccounts = await prisma.emailAccount.findMany({
    where: { userId },
    select: { id: true },
  });

  const accountIds = emailAccounts.map((a) => a.id);

  // Find the email with account info and verify ownership
  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: {
      account: {
        select: {
          id: true,
          provider: true,
          accessToken: true,
          refreshToken: true,
        },
      },
    },
  });

  if (!email || !accountIds.includes(email.accountId)) {
    return null;
  }

  return email;
}

/**
 * POST /api/emails/[id]/read
 * Mark an email as read
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to update emails" },
        { status: 401 }
      );
    }

    const { id: emailId } = await context.params;
    const userId = session.user.id;

    // Get email and verify ownership
    const email = await getEmailWithAccountIfOwned(emailId, userId);

    if (!email) {
      return NextResponse.json(
        { error: "Not Found", message: "Email not found" },
        { status: 404 }
      );
    }

    // Check if already read
    if (email.isRead) {
      return NextResponse.json({
        ...email,
        message: "Email is already marked as read",
      });
    }

    // Update local database
    const updatedEmail = await prisma.email.update({
      where: { id: emailId },
      data: { isRead: true },
    });

    // Attempt to sync with email provider (non-blocking)
    try {
      const tokens: EmailOAuthTokens = {
        accessToken: email.account.accessToken,
        refreshToken: email.account.refreshToken,
      };
      const provider = createEmailProvider(
        email.account.provider as EmailProvider,
        tokens
      );
      await provider.markAsRead(email.messageId);
    } catch (providerError) {
      const errorMessage = providerError instanceof Error ? providerError.message : "Unknown error";
      return NextResponse.json({
        ...updatedEmail,
        _warning: `Email marked as read locally, but provider sync failed: ${errorMessage}`,
      });
    }

    return NextResponse.json({
      ...updatedEmail,
      message: "Email marked as read",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/emails/[id]/read
 * Mark an email as unread
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
        { error: "Unauthorized", message: "You must be signed in to update emails" },
        { status: 401 }
      );
    }

    const { id: emailId } = await context.params;
    const userId = session.user.id;

    // Get email and verify ownership
    const email = await getEmailWithAccountIfOwned(emailId, userId);

    if (!email) {
      return NextResponse.json(
        { error: "Not Found", message: "Email not found" },
        { status: 404 }
      );
    }

    // Check if already unread
    if (!email.isRead) {
      return NextResponse.json({
        ...email,
        message: "Email is already marked as unread",
      });
    }

    // Update local database
    const updatedEmail = await prisma.email.update({
      where: { id: emailId },
      data: { isRead: false },
    });

    // Attempt to sync with email provider (non-blocking)
    try {
      const tokens: EmailOAuthTokens = {
        accessToken: email.account.accessToken,
        refreshToken: email.account.refreshToken,
      };
      const provider = createEmailProvider(
        email.account.provider as EmailProvider,
        tokens
      );
      await provider.markAsUnread(email.messageId);
    } catch (providerError) {
      const errorMessage = providerError instanceof Error ? providerError.message : "Unknown error";
      return NextResponse.json({
        ...updatedEmail,
        _warning: `Email marked as unread locally, but provider sync failed: ${errorMessage}`,
      });
    }

    return NextResponse.json({
      ...updatedEmail,
      message: "Email marked as unread",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
