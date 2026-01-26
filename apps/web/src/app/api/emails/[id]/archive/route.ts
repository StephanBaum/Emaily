/**
 * Archive Email API Route
 *
 * Handles archiving and unarchiving emails:
 * - POST /api/emails/[id]/archive - Archive an email
 * - DELETE /api/emails/[id]/archive - Unarchive an email
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
 * POST /api/emails/[id]/archive
 * Archive an email (remove from inbox)
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
        { error: "Unauthorized", message: "You must be signed in to archive emails" },
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

    // Check if already archived
    if (email.category === "archived") {
      return NextResponse.json(
        { error: "Bad Request", message: "Email is already archived" },
        { status: 400 }
      );
    }

    // Store original category for potential undo
    const previousCategory = email.category;

    // Update local database
    const updatedEmail = await prisma.email.update({
      where: { id: emailId },
      data: { category: "archived" },
    });

    // Attempt to sync with email provider (non-blocking)
    // In a production app, this would be queued for background processing
    try {
      const tokens: EmailOAuthTokens = {
        accessToken: email.account.accessToken,
        refreshToken: email.account.refreshToken,
      };
      const provider = createEmailProvider(
        email.account.provider as EmailProvider,
        tokens
      );
      await provider.archiveEmail(email.messageId);
    } catch (providerError) {
      // Log but don't fail the request - database is already updated
      // In production, queue for retry
      const errorMessage = providerError instanceof Error ? providerError.message : "Unknown error";
      // Provider sync failed but local state is updated
      return NextResponse.json({
        ...updatedEmail,
        _warning: `Email archived locally, but provider sync failed: ${errorMessage}`,
        _previousCategory: previousCategory,
      });
    }

    return NextResponse.json({
      ...updatedEmail,
      _previousCategory: previousCategory,
      message: "Email archived successfully",
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
 * DELETE /api/emails/[id]/archive
 * Unarchive an email (move back to inbox)
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
        { error: "Unauthorized", message: "You must be signed in to unarchive emails" },
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

    // Check if not archived
    if (email.category !== "archived") {
      return NextResponse.json(
        { error: "Bad Request", message: "Email is not archived" },
        { status: 400 }
      );
    }

    // Update local database - move back to inbox (null category)
    const updatedEmail = await prisma.email.update({
      where: { id: emailId },
      data: { category: null },
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
      // Use modifyLabels to add back to inbox
      await provider.modifyLabels(email.messageId, {
        addLabelIds: ["INBOX"],
      });
    } catch (providerError) {
      const errorMessage = providerError instanceof Error ? providerError.message : "Unknown error";
      return NextResponse.json({
        ...updatedEmail,
        _warning: `Email unarchived locally, but provider sync failed: ${errorMessage}`,
      });
    }

    return NextResponse.json({
      ...updatedEmail,
      message: "Email unarchived successfully",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
