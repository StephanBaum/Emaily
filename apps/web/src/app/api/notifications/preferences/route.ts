/**
 * Notification Preferences API Routes
 *
 * Handles notification preferences CRUD operations:
 * - GET /api/notifications/preferences - Get user's notification preferences
 * - POST /api/notifications/preferences - Create or update notification preferences
 * - PUT /api/notifications/preferences - Update notification preferences
 * - DELETE /api/notifications/preferences - Delete notification preferences
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, type NotificationPreference } from "@/lib/prisma";

/**
 * Response structure for notification preferences list
 */
interface NotificationPreferencesResponse {
  preferences: NotificationPreference[];
}

/**
 * Request body for creating/updating notification preferences
 */
interface NotificationPreferenceRequest {
  emailAccountId: string;
  notificationEnabled?: boolean;
  priorityOnly?: boolean;
  doNotDisturbStart?: string | null;
  doNotDisturbEnd?: string | null;
}

/**
 * GET /api/notifications/preferences
 * Get user's notification preferences for all connected email accounts
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to access notification preferences" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch all notification preferences for the user
    const preferences = await prisma.notificationPreference.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    const response: NotificationPreferencesResponse = {
      preferences,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications/preferences
 * Create or update notification preferences for an email account (upsert)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to manage notification preferences" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse request body
    let body: NotificationPreferenceRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.emailAccountId) {
      return NextResponse.json(
        { error: "Bad Request", message: "emailAccountId is required" },
        { status: 400 }
      );
    }

    // Validate doNotDisturb time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (body.doNotDisturbStart && !timeRegex.test(body.doNotDisturbStart)) {
      return NextResponse.json(
        { error: "Bad Request", message: "doNotDisturbStart must be in HH:MM format" },
        { status: 400 }
      );
    }
    if (body.doNotDisturbEnd && !timeRegex.test(body.doNotDisturbEnd)) {
      return NextResponse.json(
        { error: "Bad Request", message: "doNotDisturbEnd must be in HH:MM format" },
        { status: 400 }
      );
    }

    // Verify user owns the email account
    const emailAccount = await prisma.emailAccount.findFirst({
      where: {
        id: body.emailAccountId,
        userId,
      },
    });

    if (!emailAccount) {
      return NextResponse.json(
        { error: "Forbidden", message: "You don't have access to this email account" },
        { status: 403 }
      );
    }

    // Create or update notification preference
    const preference = await prisma.notificationPreference.upsert({
      where: {
        userId_emailAccountId: {
          userId,
          emailAccountId: body.emailAccountId,
        },
      },
      update: {
        notificationEnabled: body.notificationEnabled ?? undefined,
        priorityOnly: body.priorityOnly ?? undefined,
        doNotDisturbStart: body.doNotDisturbStart === null ? null : body.doNotDisturbStart ?? undefined,
        doNotDisturbEnd: body.doNotDisturbEnd === null ? null : body.doNotDisturbEnd ?? undefined,
        updatedAt: new Date(),
      },
      create: {
        userId,
        emailAccountId: body.emailAccountId,
        notificationEnabled: body.notificationEnabled ?? true,
        priorityOnly: body.priorityOnly ?? false,
        doNotDisturbStart: body.doNotDisturbStart ?? null,
        doNotDisturbEnd: body.doNotDisturbEnd ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Notification preferences saved successfully",
      preference,
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
 * PUT /api/notifications/preferences
 * Update notification preferences for an email account
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to manage notification preferences" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse request body
    let body: NotificationPreferenceRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.emailAccountId) {
      return NextResponse.json(
        { error: "Bad Request", message: "emailAccountId is required" },
        { status: 400 }
      );
    }

    // Validate doNotDisturb time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (body.doNotDisturbStart && !timeRegex.test(body.doNotDisturbStart)) {
      return NextResponse.json(
        { error: "Bad Request", message: "doNotDisturbStart must be in HH:MM format" },
        { status: 400 }
      );
    }
    if (body.doNotDisturbEnd && !timeRegex.test(body.doNotDisturbEnd)) {
      return NextResponse.json(
        { error: "Bad Request", message: "doNotDisturbEnd must be in HH:MM format" },
        { status: 400 }
      );
    }

    // Verify user owns the email account
    const emailAccount = await prisma.emailAccount.findFirst({
      where: {
        id: body.emailAccountId,
        userId,
      },
    });

    if (!emailAccount) {
      return NextResponse.json(
        { error: "Forbidden", message: "You don't have access to this email account" },
        { status: 403 }
      );
    }

    // Check if preference exists
    const existingPreference = await prisma.notificationPreference.findUnique({
      where: {
        userId_emailAccountId: {
          userId,
          emailAccountId: body.emailAccountId,
        },
      },
    });

    if (!existingPreference) {
      return NextResponse.json(
        { error: "Not Found", message: "Notification preference not found. Use POST to create." },
        { status: 404 }
      );
    }

    // Update notification preference
    const preference = await prisma.notificationPreference.update({
      where: {
        userId_emailAccountId: {
          userId,
          emailAccountId: body.emailAccountId,
        },
      },
      data: {
        notificationEnabled: body.notificationEnabled ?? undefined,
        priorityOnly: body.priorityOnly ?? undefined,
        doNotDisturbStart: body.doNotDisturbStart === null ? null : body.doNotDisturbStart ?? undefined,
        doNotDisturbEnd: body.doNotDisturbEnd === null ? null : body.doNotDisturbEnd ?? undefined,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Notification preferences updated successfully",
      preference,
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
 * DELETE /api/notifications/preferences
 * Delete notification preferences for an email account
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to manage notification preferences" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get emailAccountId from query parameter
    const emailAccountId = request.nextUrl.searchParams.get("emailAccountId");

    if (!emailAccountId) {
      return NextResponse.json(
        { error: "Bad Request", message: "emailAccountId query parameter is required" },
        { status: 400 }
      );
    }

    // Verify user owns the email account
    const emailAccount = await prisma.emailAccount.findFirst({
      where: {
        id: emailAccountId,
        userId,
      },
    });

    if (!emailAccount) {
      return NextResponse.json(
        { error: "Forbidden", message: "You don't have access to this email account" },
        { status: 403 }
      );
    }

    // Delete notification preference
    await prisma.notificationPreference.delete({
      where: {
        userId_emailAccountId: {
          userId,
          emailAccountId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Notification preferences deleted successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Record to delete does not exist")) {
      return NextResponse.json(
        { error: "Not Found", message: "Notification preference not found" },
        { status: 404 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
