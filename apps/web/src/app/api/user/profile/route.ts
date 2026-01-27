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
      provider: user.accounts[0]?.provider || 'unknown',
    };

    if (!user.accounts[0]?.provider) {
      console.warn(`[API] User ${userId} has no linked OAuth accounts`);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API] GET /api/user/profile failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to fetch profile" },
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
    if (body.name === undefined && body.image === undefined) {
      return NextResponse.json(
        { error: "Bad Request", message: "At least one field (name or image) must be provided" },
        { status: 400 }
      );
    }

    // Validate name length if provided
    if (body.name !== undefined && body.name && body.name.length > 255) {
      return NextResponse.json(
        { error: "Bad Request", message: "Name must be 255 characters or less" },
        { status: 400 }
      );
    }

    // Validate image URL format if provided
    if (body.image !== undefined && body.image) {
      try {
        new URL(body.image);
      } catch {
        return NextResponse.json(
          { error: "Bad Request", message: "Image must be a valid URL" },
          { status: 400 }
        );
      }
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
      provider: updatedUser.accounts[0]?.provider || 'unknown',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API] PATCH /api/user/profile failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to update profile" },
      { status: 500 }
    );
  }
}
