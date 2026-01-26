/**
 * Individual Email API Routes
 *
 * Handles operations on a single email:
 * - GET /api/emails/[id] - Get email details
 * - PATCH /api/emails/[id] - Update email properties
 * - DELETE /api/emails/[id] - Delete email
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, type Email } from "@/lib/prisma";

/**
 * Route context with dynamic parameters
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Get email by ID and verify ownership
 * Returns the email if found and owned by user, null otherwise
 */
async function getEmailIfOwned(
  emailId: string,
  userId: string
): Promise<Email | null> {
  // Get user's email accounts
  const emailAccounts = await prisma.emailAccount.findMany({
    where: { userId },
    select: { id: true },
  });

  const accountIds = emailAccounts.map((a) => a.id);

  // Find the email and verify ownership
  const email = await prisma.email.findUnique({
    where: { id: emailId },
  });

  if (!email || !accountIds.includes(email.accountId)) {
    return null;
  }

  return email;
}

/**
 * GET /api/emails/[id]
 * Get a single email by ID
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

    const { id: emailId } = await context.params;
    const userId = session.user.id;

    // Get email and verify ownership
    const email = await getEmailIfOwned(emailId, userId);

    if (!email) {
      return NextResponse.json(
        { error: "Not Found", message: "Email not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(email);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

/**
 * Update request body structure
 */
interface UpdateEmailRequest {
  /** Mark as read/unread */
  isRead?: boolean;
  /** Star/unstar email */
  isStarred?: boolean;
  /** Update category (e.g., "important", "promotional") */
  category?: string | null;
  /** Update priority (1-5) */
  priority?: number | null;
}

/**
 * PATCH /api/emails/[id]
 * Update email properties (read status, starred, category, priority)
 */
export async function PATCH(
  request: NextRequest,
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

    const { id: emailId } = await context.params;
    const userId = session.user.id;

    // Parse request body
    let body: UpdateEmailRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate request body
    const allowedFields = ["isRead", "isStarred", "category", "priority"];
    const providedFields = Object.keys(body);
    const invalidFields = providedFields.filter((f) => !allowedFields.includes(f));

    if (invalidFields.length > 0) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: `Invalid fields: ${invalidFields.join(", ")}. Allowed: ${allowedFields.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (providedFields.length === 0) {
      return NextResponse.json(
        { error: "Bad Request", message: "No fields to update" },
        { status: 400 }
      );
    }

    // Validate priority if provided
    if (body.priority !== undefined && body.priority !== null) {
      if (typeof body.priority !== "number" || body.priority < 1 || body.priority > 5) {
        return NextResponse.json(
          { error: "Bad Request", message: "priority must be a number between 1 and 5" },
          { status: 400 }
        );
      }
    }

    // Get email and verify ownership
    const existingEmail = await getEmailIfOwned(emailId, userId);

    if (!existingEmail) {
      return NextResponse.json(
        { error: "Not Found", message: "Email not found" },
        { status: 404 }
      );
    }

    // Build update data - only include fields that were provided
    const updateData: Parameters<typeof prisma.email.update>[0]["data"] = {};

    if (body.isRead !== undefined) {
      updateData.isRead = body.isRead;
    }
    if (body.isStarred !== undefined) {
      updateData.isStarred = body.isStarred;
    }
    if (body.category !== undefined) {
      updateData.category = body.category;
    }
    if (body.priority !== undefined) {
      updateData.priority = body.priority;
    }

    // Update the email
    const updatedEmail = await prisma.email.update({
      where: { id: emailId },
      data: updateData,
    });

    return NextResponse.json(updatedEmail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/emails/[id]
 * Delete a single email
 */
export async function DELETE(
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

    const { id: emailId } = await context.params;
    const userId = session.user.id;

    // Get email and verify ownership
    const email = await getEmailIfOwned(emailId, userId);

    if (!email) {
      return NextResponse.json(
        { error: "Not Found", message: "Email not found" },
        { status: 404 }
      );
    }

    // Delete the email
    await prisma.email.delete({
      where: { id: emailId },
    });

    return NextResponse.json({
      success: true,
      message: "Email deleted successfully",
      deletedId: emailId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
