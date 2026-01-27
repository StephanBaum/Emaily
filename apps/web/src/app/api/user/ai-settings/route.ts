/**
 * AI Settings API Routes
 *
 * Handles user AI configuration:
 * - GET /api/user/ai-settings - Get current user's AI settings
 * - PATCH /api/user/ai-settings - Update AI provider and API key
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, type User } from "@/lib/prisma";

/**
 * Response structure for AI settings
 */
interface AiSettingsResponse {
  aiProvider: string;
  openAiApiKey: string | null;
  apiKeyConfigured: boolean;
}

/**
 * Request body for AI settings update
 */
interface UpdateAiSettingsRequest {
  aiProvider?: string;
  openAiApiKey?: string;
}

/**
 * Mask API key for display (show only last 4 characters)
 */
function maskApiKey(apiKey: string | null): string | null {
  if (!apiKey || apiKey.length < 8) {
    return null;
  }
  return `sk-...${apiKey.slice(-4)}`;
}

/**
 * GET /api/user/ai-settings
 * Get current user's AI settings
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to access AI settings" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch user's AI settings
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        aiProvider: true,
        openAiApiKey: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Not Found", message: "User not found" },
        { status: 404 }
      );
    }

    const response: AiSettingsResponse = {
      aiProvider: user.aiProvider || "openai",
      openAiApiKey: maskApiKey(user.openAiApiKey),
      apiKeyConfigured: !!user.openAiApiKey,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API] GET /api/user/ai-settings failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to fetch AI settings" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/ai-settings
 * Update user's AI settings (provider and/or API key)
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to update AI settings" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse request body
    let body: UpdateAiSettingsRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Validate that at least one field is provided
    if (body.aiProvider === undefined && body.openAiApiKey === undefined) {
      return NextResponse.json(
        { error: "Bad Request", message: "At least one field (aiProvider or openAiApiKey) must be provided" },
        { status: 400 }
      );
    }

    // Validate AI provider if provided
    if (body.aiProvider !== undefined) {
      const validProviders = ["openai", "anthropic", "google"];
      if (body.aiProvider && !validProviders.includes(body.aiProvider)) {
        return NextResponse.json(
          { error: "Bad Request", message: `Invalid AI provider. Must be one of: ${validProviders.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // Validate API key format if provided (basic validation for OpenAI keys)
    if (body.openAiApiKey !== undefined && body.openAiApiKey) {
      if (!body.openAiApiKey.startsWith("sk-") || body.openAiApiKey.length < 20) {
        return NextResponse.json(
          { error: "Bad Request", message: "Invalid API key format. OpenAI keys should start with 'sk-'" },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: Partial<User> = {};
    if (body.aiProvider !== undefined) {
      updateData.aiProvider = body.aiProvider || null;
    }
    if (body.openAiApiKey !== undefined) {
      updateData.openAiApiKey = body.openAiApiKey || null;
    }

    // Update user's AI settings
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        aiProvider: true,
        openAiApiKey: true,
      },
    });

    const response: AiSettingsResponse = {
      aiProvider: updatedUser.aiProvider || "openai",
      openAiApiKey: maskApiKey(updatedUser.openAiApiKey),
      apiKeyConfigured: !!updatedUser.openAiApiKey,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API] PATCH /api/user/ai-settings failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to update AI settings" },
      { status: 500 }
    );
  }
}
