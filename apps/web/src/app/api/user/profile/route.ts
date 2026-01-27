/**
 * User Profile API Routes
 *
 * Handles user profile retrieval and updates:
 * - GET /api/user/profile - Get current user's profile
 * - PATCH /api/user/profile - Update user's profile (name, image)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, type User } from "@/lib/prisma";

/**
 * Response structure for user profile
 */
interface UserProfileResponse {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: Date | null;
  createdAt: Date;
  updatedAt: Date;
  provider: string;
}

/**
 * Request body for profile update
 */
interface UpdateProfileRequest {
  name?: string;
  image?: string;
}

/**
 * GET /api/user/profile
 * Get current user's profile
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to access your profile" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch user profile WITH oauth account provider
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        accounts: {
          select: {
            provider: true,
          },
          take: 1, // Get first OAuth account
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Not Found", message: "User profile not found" },
        { status: 404 }
      );
    }

    const response: UserProfileResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      provider: user.accounts[0]?.provider || 'google',
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
 * PATCH /api/user/profile
 * Update user's profile (name and/or image)
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to update your profile" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse request body
    let body: UpdateProfileRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Validate that at least one field is provided
    if (!body.name && !body.image && body.name !== "" && body.image !== "") {
      return NextResponse.json(
        { error: "Bad Request", message: "At least one field (name or image) must be provided" },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Partial<User> = {};
    if (body.name !== undefined) {
      updateData.name = body.name || null;
    }
    if (body.image !== undefined) {
      updateData.image = body.image || null;
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        accounts: {
          select: {
            provider: true,
          },
          take: 1,
        },
      },
    });

    const response: UserProfileResponse = {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      image: updatedUser.image,
      emailVerified: updatedUser.emailVerified,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
      provider: updatedUser.accounts[0]?.provider || 'google',
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
