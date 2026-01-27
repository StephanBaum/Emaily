/**
 * Device Token Registration API Route
 *
 * Handles device push notification token registration:
 * - POST /api/notifications/register - Register or update device push token
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, type PushSubscription } from "@/lib/prisma";

/**
 * Request body for device token registration
 */
interface DeviceTokenRequest {
  deviceToken: string;
  platform: "ios" | "android";
  expoToken?: string;
}

/**
 * Response structure for successful registration
 */
interface DeviceTokenResponse {
  success: boolean;
  message: string;
  subscription: PushSubscription;
}

/**
 * POST /api/notifications/register
 * Register or update device push token for the authenticated user
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to register device tokens" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse request body
    let body: DeviceTokenRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.deviceToken) {
      return NextResponse.json(
        { error: "Bad Request", message: "deviceToken is required" },
        { status: 400 }
      );
    }

    if (!body.platform) {
      return NextResponse.json(
        { error: "Bad Request", message: "platform is required" },
        { status: 400 }
      );
    }

    // Validate platform value
    if (body.platform !== "ios" && body.platform !== "android") {
      return NextResponse.json(
        { error: "Bad Request", message: "platform must be 'ios' or 'android'" },
        { status: 400 }
      );
    }

    // Create or update push subscription (upsert based on userId + deviceToken unique constraint)
    const subscription = await prisma.pushSubscription.upsert({
      where: {
        userId_deviceToken: {
          userId,
          deviceToken: body.deviceToken,
        },
      },
      update: {
        platform: body.platform,
        expoToken: body.expoToken ?? undefined,
        active: true,
        updatedAt: new Date(),
      },
      create: {
        userId,
        deviceToken: body.deviceToken,
        platform: body.platform,
        expoToken: body.expoToken ?? null,
        active: true,
      },
    });

    const response: DeviceTokenResponse = {
      success: true,
      message: "Device token registered successfully",
      subscription,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
